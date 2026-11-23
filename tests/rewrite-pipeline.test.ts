import { describe, it, expect, vi } from "vitest";
import {
  lockRewriteSpans,
  restoreRewriteSpans,
  splitRewrite,
  runRewritePipeline,
} from "@/lib/humanizer/rewrite-pipeline";
import {
  focusedComparisonIssue,
  focusedEvaluationIssue,
  reviewRewrite,
} from "@/lib/humanizer/rewrite-review";
import {
  cleanLlmOutput,
  RewriteOutputLimitError,
} from "@/lib/humanizer/output-cleaner";
const noop = () => {};
describe("Protected rewrite pipeline", () => {
  it("recovers from broken markers by editing surrounding prose while retaining fact-bearing sentences exactly", async () => {
    const text =
      'In 2024, Ana said "wait". At the present moment in time, we need to review the results.';
    let calls = 0;
    const result = await runRewritePipeline({
      text,
      mode: "concise",
      terms: ["Ana"],
      onProgress: noop,
      generate: async (request) => {
        calls++;
        if (calls <= 2) return "Invalid draft with missing facts.";
        expect(request.userPrompt).not.toContain("2024");
        expect(request.userPrompt).not.toContain("wait");
        return "We need to review the results now.";
      },
    });
    expect(calls).toBe(3);
    expect(result.changed).toBe(true);
    expect(result.text).toBe(
      'In 2024, Ana said "wait". We need to review the results now.',
    );
    expect(result.warnings.join(" ")).toContain(
      "protected sentences kept intact",
    );
  });
  it("accepts only complete known markers when the model varies whitespace, case or escaping", () => {
    const locked = lockRewriteSpans('In 2024, Ana said "wait".');
    const variant = locked.text
      .replace("VTLOCK_0_END", "vtlock 0 end")
      .replace("VTLOCK_1_END", String.raw`VTLOCK\_1\_END`);
    expect(restoreRewriteSpans(variant, locked)).toBe(
      'In 2024, Ana said "wait".',
    );
    expect(() =>
      restoreRewriteSpans(variant + " vtlock_999_end", locked),
    ).toThrow("unknown");
  });
  it("protects signs and scientific notation instead of overlooking reversed quantities", () => {
    const text = "Temperature was -12.5 and the tolerance was 1e-3.";
    const locked = lockRewriteSpans(text);
    expect(locked.locks.map((x) => x.value)).toEqual(["-12.5", "1e-3"]);
    expect(restoreRewriteSpans(locked.text, locked)).toBe(text);
  });
  it("restores exact short quotes, numbers, citations, code, URLs and locked names", () => {
    const text =
      'In 2024, Ana said "wait" (Smith, 2024). Cost: €1,250.50; limit 15%. See https://example.com/report and `x = 12`. VTLOCK is a source word.';
    const locked = lockRewriteSpans(text, ["Ana"]);
    expect(locked.prefix).not.toBe("VTLOCK");
    expect(locked.text).not.toContain("Ana");
    expect(restoreRewriteSpans(locked.text, locked)).toBe(text);
    expect(() =>
      restoreRewriteSpans(
        locked.text.replace(locked.locks[0]!.token, ""),
        locked,
      ),
    ).toThrow();
    expect(() =>
      restoreRewriteSpans(locked.text + locked.locks[0]!.token, locked),
    ).toThrow();
  });
  it("preserves complete long protected blocks and paragraph spacing when chunked", async () => {
    const text =
      "This is the opening paragraph.\n\n" +
      "```\n" +
      "const x = 12;\n".repeat(300) +
      "```\n\nThis is the closing paragraph.";
    const result = await runRewritePipeline({
      text,
      mode: "standard",
      onProgress: noop,
      generate: async (request) => request.userPrompt.split("\n\n").at(-1)!,
    });
    expect(result.text).toContain(
      "```\n" + "const x = 12;\n".repeat(300) + "```",
    );
    expect(
      splitRewrite("  One.\n\nTwo.  ")
        .map((p) => p.text + p.separator)
        .join(""),
    ).toBe("  One.\n\nTwo.  ");
  });
  it("retries copied input and accepts a changed rewrite with locked facts", async () => {
    const text = "Ana did not review 40 applications in 2024.";
    const generate = vi.fn(async (request: { userPrompt: string }) => {
      const passage = request.userPrompt.split("\n\n").at(-1)!;
      return generate.mock.calls.length === 1
        ? passage
        : passage.replace("did not review", "did not examine");
    });
    const result = await runRewritePipeline({
      text,
      mode: "standard",
      terms: ["Ana"],
      generate,
      onProgress: noop,
    });
    expect(result.retries).toBe(1);
    expect(result.retained).toBe(0);
    expect(result.text).toBe("Ana did not examine 40 applications in 2024.");
  });
  it("retains and labels the original section after repeated factual or unchanged failures", async () => {
    const text = "The experiment did not reduce costs by 15%.";
    const result = await runRewritePipeline({
      text,
      mode: "standard",
      generate: async () => "The experiment reduced costs by 25%.",
      onProgress: noop,
    });
    expect(result.text).toBe(text);
    expect(result.retained).toBe(1);
    expect(result.changed).toBe(false);
    expect(result.warnings).toHaveLength(1);
  });
  it("never accepts a reversed claim on the second attempt when no facts are masked", async () => {
    const text =
      "The committee did not approve the proposal because the evidence was incomplete.";
    const result = await runRewritePipeline({
      text,
      mode: "standard",
      onProgress: noop,
      generate: async () =>
        "The committee approved the proposal because the evidence was incomplete.",
    });
    expect(result.text).toBe(text);
    expect(result.changed).toBe(false);
    expect(
      result.checks.every((check) => check.reason.includes("Negation changed")),
    ).toBe(true);
  });
  it("does not erase a user's literal marker-like text during preview", () => {
    const source = "Keep __KEEP_4__ in the command documentation.";
    const locked = lockRewriteSpans(source);
    expect(restoreRewriteSpans(source, locked, false)).toBe(source);
  });
  it("passes full rewrite instructions to retries while rejecting reversed claims", async () => {
    const text =
      "The committee did not approve the proposal because the evidence was incomplete.";
    const generate = vi.fn(async (request) => {
      expect(request.systemPrompt).toContain("fresh version");
      return "The committee approved the proposal because the evidence was incomplete.";
    });
    const result = await runRewritePipeline({
      text,
      mode: "professional",
      depth: "rephrase",
      onProgress: noop,
      generate,
    });
    expect(result.text).toBe(text);
    expect(result.changed).toBe(false);
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it("gives full rewriting readable facts and rejects changed facts before accepting a retry", async () => {
    const text =
      'Ana reviewed 40 applications in 2024. She said "wait" and did not approve the proposal.';
    const generate = vi.fn(async (request) => {
      expect(request.userPrompt).toContain(text);
      expect(request.userPrompt).not.toContain("VTLOCK");
      return generate.mock.calls.length === 1
        ? 'Ana reviewed 41 applications in 2024. She said "wait" and did not approve the proposal.'
        : 'In 2024, Ana examined 40 applications. She said "wait" and did not approve the proposal.';
    });
    const result = await runRewritePipeline({
      text,
      mode: "standard",
      depth: "rephrase",
      terms: ["Ana"],
      onProgress: noop,
      generate,
    });
    expect(result.text).toContain("examined 40 applications");
    expect(result.changed).toBe(true);
    expect(result.retries).toBe(1);
    expect(result.checks[0]?.reason).toContain("Numbers or amounts changed");
  });
  it("keeps oversized protected blocks masked even in full rewrite mode", async () => {
    const text = "```\n" + "const x = 12;\n".repeat(300) + "```";
    const result = await runRewritePipeline({
      text,
      mode: "standard",
      depth: "rephrase",
      onProgress: noop,
      generate: async (request) => {
        expect(request.userPrompt.length).toBeLessThan(1000);
        expect(request.userPrompt).toContain("VTLOCK");
        return request.userPrompt.split("\n\n").at(-1)!;
      },
    });
    expect(result.text).toBe(text);
    expect(result.changed).toBe(false);
  });
  it("keeps a checked light edit when a stronger rewrite loses a qualifier", async () => {
    const text =
      "The neighborhood library can serve residents in several ways. Adults may learn how to use public services in evening classes. Students can bring their assignments to the quiet room. Volunteers help visitors sign up for new programs. Managers should check which programs serve people who do not already have a library card. The next meeting is about how to measure success.";
    const light = text.replace("next meeting", "upcoming meeting");
    const generate = vi.fn(async ({ attempt }) =>
      attempt === 0 ? light : text.replace("Adults may learn", "Adults learn"),
    );
    const result = await runRewritePipeline({
      text,
      mode: "standard",
      depth: "rephrase",
      onProgress: noop,
      generate,
    });
    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.text).toBe(light);
    expect(result.warnings.join(" ")).toContain("light wording changes");
    expect(
      result.checks.some((check) =>
        check.reason.includes("Possibility wording changed"),
      ),
    ).toBe(true);
  });

  it("includes the original qualifiers in instructions for a failed factual retry", async () => {
    const text =
      "The draft may be circulated after the review, but the board won’t approve it this week.";
    const generate = vi.fn(async ({ attempt, userPrompt }) => {
      if (attempt === 0)
        return "The draft will be circulated after the review, and the board will approve it this week.";
      expect(userPrompt).toContain(
        "Keep these qualifiers with their original claims: may",
      );
      expect(userPrompt).toContain(
        "negative expressions with their original claims: won’t",
      );
      return text.replace("circulated", "shared");
    });
    const result = await runRewritePipeline({
      text,
      mode: "standard",
      onProgress: noop,
      generate,
    });
    expect(result.changed).toBe(true);
    expect(result.retries).toBe(1);
  });

  it("rewrites smaller qualified passages and retains any passage that fails its own checks", async () => {
    const text =
      "Adults may learn how to use public services in evening classes when the library is open. The staff prepare the rooms before the visitors arrive and leave the printed guides on the desks near the front of the room. The library will not require people to register in advance because the staff want residents to be able to drop in when they have time.";
    const generate = vi.fn(async ({ attempt, userPrompt }) => {
      if (attempt < 2)
        return text.replace("Adults may learn", "Adults will learn");
      const excerpt = userPrompt.split("\n\n").at(-1)!;
      if (excerpt.startsWith("Adults may"))
        return "In the evening, adults may learn to use public services in classes held during library hours.";
      if (excerpt.startsWith("The library will not"))
        return excerpt.replace("will not", "will");
      return excerpt;
    });
    const result = await runRewritePipeline({
      text,
      mode: "standard",
      depth: "rephrase",
      onProgress: noop,
      generate,
    });
    expect(result.text).toContain("In the evening, adults may learn");
    expect(result.text).toContain("The library will not require");
    expect(result.warnings.join(" ")).toContain(
      "protected sentences kept intact",
    );
    expect(generate).toHaveBeenCalledTimes(5);
  });

  it("does not accept a dropped approval action even when every number is retained", async () => {
    const fact =
      "In 2024, Ana reviewed 40 applications for Project Atlas and approved 12 for further study.";
    const text =
      fact + " The team will discuss the results at the next meeting.";
    const generate = vi.fn(async ({ attempt, systemPrompt }) => {
      if (attempt < 2) {
        expect(systemPrompt).toContain(
          "actions and subjects tied to those amounts",
        );
        return "In 2024, Ana received 40 applications for Project Atlas and 12 for further study. The team will discuss the results at the next meeting.";
      }
      return "At the next meeting, the team will discuss the results.";
    });
    const result = await runRewritePipeline({
      text,
      mode: "standard",
      depth: "rephrase",
      onProgress: noop,
      generate,
    });
    expect(result.text).toBe(
      fact + " At the next meeting, the team will discuss the results.",
    );
    expect(result.checks[0]?.reason).toContain(
      "Protected quantity claim changed",
    );
  });

  it("catches values reassigned between study groups in separate sentences", () => {
    const source =
      "The morning-light group gained 12 grams. The evening-light group gained 7 grams.";
    const swapped =
      "The afternoon trays recorded a gain of 12 grams. The morning-light group gained 7 grams.";
    expect(reviewRewrite(source, swapped)).toEqual([
      "Protected quantity claim changed: The morning-light group gained 12 grams.",
      "Protected quantity claim changed: The evening-light group gained 7 grams.",
    ]);
  });

  it("keeps the terminal claim when repeated drafts drop it", async () => {
    const source =
      "The west entrance will be closed for repairs. Visitors should enter through the east doors. Staff will post signs around the building. The library will keep its usual hours throughout the repair.";
    const draft =
      "Use the east doors while crews repair the west entrance. Staff will post signs around the building.";
    const generate = vi.fn(async ({ userPrompt, attempt }) => {
      if (attempt === 1)
        expect(userPrompt).toContain("original final sentence verbatim");
      if (attempt >= 2)
        expect(userPrompt).not.toContain("usual hours throughout");
      return draft;
    });
    const result = await runRewritePipeline({
      text: source,
      mode: "standard",
      depth: "rephrase",
      onProgress: noop,
      generate,
    });
    expect(result.text).toBe(
      draft + " The library will keep its usual hours throughout the repair.",
    );
    expect(result.checks[0]?.reason).toContain(
      "Possible omission in the closing sentence",
    );
  });

  it("keeps a closing recommendation and its condition together", async () => {
    const first = "The team compared two planting schedules.";
    const ending =
      "The team recommends repeating the experiment with the shelves assigned at random before drawing a conclusion.";
    const editedFirst = "The researchers tested two planting schedules.";
    const shortened =
      "The team recommends randomizing the shelves before drawing a conclusion.";
    const result = await runRewritePipeline({
      text: first + " " + ending,
      mode: "standard",
      depth: "rephrase",
      onProgress: noop,
      generate: async ({ attempt, systemPrompt }) => {
        if (attempt < 2) {
          expect(systemPrompt).toContain(
            "closing recommendation and its conditions",
          );
          return editedFirst + " " + shortened;
        }
        return editedFirst;
      },
    });
    expect(result.text).toBe(editedFirst + " " + ending);
    expect(result.checks[0]?.reason).toContain(
      "Protected closing recommendation changed",
    );
  });

  it("passes a custom style preference while retaining the factual checks", async () => {
    const text = "The library does not require a reservation.";
    const generate = vi.fn(async ({ systemPrompt, attempt }) => {
      expect(systemPrompt).toContain("Friendly and direct");
      expect(systemPrompt).toContain(
        "Preserve facts and meaning over any style preference",
      );
      return attempt === 0
        ? "The library requires a reservation."
        : "You do not need to reserve a spot at the library.";
    });
    const result = await runRewritePipeline({
      text,
      mode: "standard",
      depth: "rephrase",
      styleNote: "Friendly and direct",
      generate,
      onProgress: noop,
    });
    expect(result.text).toBe(
      "You do not need to reserve a spot at the library.",
    );
    expect(result.retries).toBe(1);
  });

  it("flags a closing detail replaced with filler at the same sentence count", () => {
    const original =
      "The west entrance will be closed for repairs. Visitors need to use the east entrance during the work. Staff will post directions around the building. The library will keep its usual hours throughout the repair.";
    const candidate =
      "The west entrance will be closed for repairs. Visitors need to use the east entrance during the work. Staff will post directions around the building. Please take care during your visit.";
    expect(reviewRewrite(original, candidate).join(" ")).toContain(
      "Possible omission in the closing sentence",
    );
  });

  it("keeps a checked light edit if the optional larger edit cannot finish", async () => {
    const original =
      "The library gives visitors a place to read, work, and meet people from nearby streets. "
        .repeat(5)
        .trim();
    const candidate = original.replace(
      "gives visitors a place",
      "offers visitors a place",
    );
    const generate = vi.fn(async ({ attempt }) => {
      if (attempt) throw new Error("Connection ended.");
      return candidate;
    });
    const result = await runRewritePipeline({
      text: original,
      mode: "standard",
      depth: "rephrase",
      generate,
      onProgress: noop,
    });
    expect(result.text).toBe(candidate);
    expect(generate).toHaveBeenCalledTimes(2);
    expect(result.checks.map((check) => check.reason).join(" ")).toContain(
      "The draft that passed checks was kept",
    );
  });

  it("does not ask for a larger edit when exact protected sentences leave little prose to rewrite", async () => {
    const original =
      "The study counted 42 participants during the morning sessions at the community center and included people who used the service every week. The afternoon group included 31 participants who had signed up through the same program and whose appointments took place after the main office had closed for the day. The public report is now available through the front desk for anyone who wants a copy.";
    const candidate = original.replace(
      "is now available through",
      "is now available from",
    );
    const generate = vi.fn(async () => candidate);
    const result = await runRewritePipeline({
      text: original,
      mode: "standard",
      depth: "rephrase",
      generate,
      onProgress: noop,
    });
    expect(result.text).toBe(candidate);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("recovers a length-limited rewrite using shorter source groups", async () => {
    const first =
      "The team needs to review the workshop feedback before deciding which changes to make and how to schedule the next series. ".repeat(
        4,
      );
    const second =
      "The library runs a series of sessions for visitors who want help with reading, technology and everyday tasks. "
        .repeat(4)
        .trim();
    const generate = vi.fn(async ({ attempt, userPrompt }) => {
      if (attempt === 0) throw new RewriteOutputLimitError();
      const excerpt = userPrompt.split("\n\n").at(-1)!;
      expect(excerpt.length).toBeLessThanOrEqual(700);
      return excerpt
        .replaceAll("needs to review", "should review")
        .replaceAll("runs a series of", "offers");
    });
    const result = await runRewritePipeline({
      text: first + second,
      mode: "standard",
      generate,
      onProgress: noop,
    });
    expect(generate).toHaveBeenCalledTimes(3);
    expect(result.changed).toBe(true);
    expect(result.text).toContain("should review the workshop feedback");
    expect(result.text).toContain("offers sessions for visitors");
    expect(result.checks[0]?.reason).toContain("output limit");
  });

  it("catches a qualified claim whose effect is kept but assigned to something else", () => {
    const original =
      "A small change to the timetable may help more readers than an expensive renovation.";
    const drifted =
      "Checking existing services may help more readers than an expensive renovation.";
    const legitimate =
      "A small timetable adjustment may help more readers than a costly renovation.";
    expect(reviewRewrite(original, drifted)).toContain(
      "Possibility wording changed. The subject of a qualified claim may have changed.",
    );
    expect(reviewRewrite(original, legitimate)).toEqual([]);
  });

  it("catches the actor reassignment from the reported full rewrite", () => {
    const original =
      "Opening hours need to match the lives of local residents, and staff need time to answer questions rather than spend every shift sorting returns.";
    const wrong =
      "Opening hours should match the lives of local residents, allowing them time to answer questions rather than spending every shift processing returns.";
    const faithful =
      "Opening hours should fit local residents' schedules. Staff need time to answer questions instead of spending every shift sorting returns.";
    expect(reviewRewrite(original, wrong)).toContain(
      "Protected actor changed. Keep staff responsible for the original action.",
    );
    expect(reviewRewrite(original, faithful)).toEqual([]);
  });

  it("rewrites qualified long paragraphs in bounded sentence groups and preserves exact separators", async () => {
    const sentences = [
      "A neighborhood library can offer people a quiet place to work away from interruptions.",
      "Visitors can also meet their neighbors through weekly activities run by the staff.",
      "The staff prepare a shared table before each workshop so participants can find the materials.",
      "The public schedule might change when volunteers are unavailable to cover a weekend session.",
      "The organizers will not cancel the program simply because attendance dips for a week.",
      "They plan to talk to visitors before setting dates for the next round of activities.",
      "The notice board by the entrance carries the current schedule for everyone to see.",
      "Someone can call the front desk when the printed hours and the website disagree.",
      "The team will update the notice board and tell visitors about each schedule change.",
    ];
    const text = sentences.join("  ");
    const drafts = [
      "A quiet place to work is one thing a neighborhood library can offer. Weekly activities can help visitors get to know their neighbors. Staff put the materials on a shared table before each workshop so participants can find them.",
      "The posted schedule might shift if volunteers are unavailable for a weekend session. A brief dip in attendance will not prompt the organizers to cancel. Before choosing dates for the next round, they intend to ask visitors for input.",
      "For the latest schedule, check the notice board by the entrance. If the website and printed hours conflict, visitors can call the front desk. The team will post every change on the board and let visitors know.",
    ];
    const generated: string[] = [];
    const prompts: string[] = [];
    const result = await runRewritePipeline({
      text,
      mode: "standard",
      depth: "rephrase",
      onProgress: noop,
      generate: async ({ systemPrompt, userPrompt }) => {
        prompts.push(systemPrompt);
        const source = userPrompt.split("\n\n").at(-1)!;
        generated.push(source);
        return drafts[generated.length - 1]!;
      },
    });
    expect(generated).toEqual([
      sentences.slice(0, 3).join("  "),
      sentences.slice(3, 6).join("  "),
      sentences.slice(6).join("  "),
    ]);
    expect(prompts[1]).toContain(sentences[0]);
    expect(prompts[1]).toContain(sentences[2]);
    expect(result.text).toBe(drafts.join("  "));
  });

  it("preserves the prerequisite and each action of a long conditional instruction", () => {
    const original =
      "Before expanding, library managers should ask visitors what they use, listen to people who never come through the door, and check whether existing services reach the people they were designed for.";
    const drifted =
      "Library managers should ask visitors what they use, listen to people who never come through the door, and check whether existing services reach the people they were designed for.";
    expect(reviewRewrite(original, drifted).join(" ")).toContain(
      "Protected conditional instructions changed",
    );
    expect(reviewRewrite(original, original)).toEqual([]);
  });

  it("edits the library sample around exact claims from the first pass and retries only the affected excerpt", async () => {
    const opening = "A neighborhood library can do more than lend books.";
    const benefits =
      "It gives people a place to study, meet neighbors, and learn skills they might not otherwise have the chance to practice.";
    const contrast =
      "Evening classes can help adults use online services, while quiet rooms give students somewhere to work when home is crowded.";
    const operations =
      "These benefits depend on practical choices. Opening hours need to match the lives of local residents, and staff need time to answer questions rather than spend every shift sorting returns. A larger building will not solve those problems on its own.";
    const checklist =
      "Before expanding, library managers should ask visitors what they use, listen to people who never come through the door, and check whether existing services reach the people they were designed for.";
    const comparison =
      "A small change to the timetable may help more readers than an expensive renovation.";
    const measure =
      "The useful measure is whether the library makes everyday life easier for the community it serves.";
    const text = [
      opening,
      benefits,
      contrast,
      operations,
      checklist,
      comparison,
      measure,
    ].join("  ");
    const rewrittenOpening =
      "Lending books is just one thing a neighborhood library can do.";
    const rewrittenOperations =
      "Practical choices determine how much good these services do. Set opening hours to fit local residents' schedules. Give staff time to answer questions instead of spending every shift sorting returns. A bigger library building will not solve these problems on its own.";
    const rewrittenComparison =
      "More readers may benefit from adjusting the timetable slightly than from paying for a costly renovation.";
    const rewrittenMeasure =
      "Judge the library by how much easier it makes everyday life for the community it serves.";
    const requests: string[] = [];
    const result = await runRewritePipeline({
      text,
      mode: "standard",
      depth: "rephrase",
      onProgress: noop,
      generate: async ({ userPrompt, systemPrompt, attempt }) => {
        const excerpt = userPrompt.split("\n\n").at(-1)!;
        requests.push(excerpt);
        if (excerpt === opening)
          return attempt
            ? rewrittenOpening
            : "Can a neighborhood library do more than lend books?";
        if (excerpt === operations) return rewrittenOperations;
        expect(systemPrompt).not.toContain("A larger building will not");
        expect(userPrompt).toContain("Return one sentence of roughly");
        if (excerpt === comparison)
          return attempt
            ? rewrittenComparison
            : "More readers benefit from a small change to the timetable than from an expensive renovation.";
        if (excerpt === measure) return rewrittenMeasure;
        throw new Error("Unexpected editable excerpt");
      },
    });
    expect(requests).toEqual([
      opening,
      opening,
      operations,
      comparison,
      comparison,
      measure,
    ]);
    expect(result.text).toBe(
      [
        rewrittenOpening,
        benefits,
        contrast,
        rewrittenOperations,
        checklist,
        rewrittenComparison,
        rewrittenMeasure,
      ].join("  "),
    );
    expect(result).toMatchObject({
      parts: 3,
      retained: 0,
      retries: 2,
      lightFallback: false,
    });
    expect(result.checks[0]?.reason).toContain(
      "Keep the statement as a statement",
    );
    expect(result.checks[1]?.reason).toContain("Possibility wording changed");
  });

  it("rejects invented commercial owners, services and new outcomes from the Llama retest", () => {
    const source =
      "Opening hours need to match the lives of local residents, and staff need time to answer questions rather than spend every shift sorting returns. A larger building will not solve those problems on its own.";
    const libraryContext = "A library is in the neighborhood. " + source;
    const restriction =
      "Protected meaning changed. Remove the added owner, service or independent claim.";
    expect(
      reviewRewrite(
        source,
        source.replace("Opening hours", "For a store, opening hours"),
        "standard",
        [],
        libraryContext,
      ),
    ).toContain(restriction);
    expect(
      reviewRewrite(
        source,
        source.replace(
          "on its own.",
          "on its own; rather, it is just one aspect of an efficient workplace layout.",
        ),
      ),
    ).toContain(restriction);
    expect(
      reviewRewrite(
        source,
        source.replace("Opening hours", "The store's opening hours"),
      ),
    ).toContain(restriction);
    expect(
      reviewRewrite(
        source,
        source.replace(
          "answer questions",
          "answer questions and provide personalized service,",
        ),
      ),
    ).toContain(restriction);
    expect(
      reviewRewrite(
        source,
        source.replace(
          "on its own.",
          "on its own; it simply provides more space for employees to work efficiently.",
        ),
      ),
    ).toContain(restriction);
    expect(
      reviewRewrite(
        source,
        source.replace(
          "those problems",
          "the problems of overcrowding and long wait times",
        ),
      ),
    ).toContain(restriction);
    expect(
      reviewRewrite(
        source,
        source.replace(
          "those problems",
          "issues with opening hours and staffing",
        ),
      ),
    ).not.toContain(restriction);
    expect(
      reviewRewrite(
        source,
        source.replace("Opening hours", "The library's opening hours"),
        "standard",
        [],
        "A library is in the neighborhood. " + source,
      ),
    ).not.toContain(restriction);
  });

  it("keeps both library comparisons from the focused Llama retest", () => {
    const opening = "A neighborhood library can do more than lend books.";
    const timetable =
      "A small change to the timetable may help more readers than an expensive renovation.";
    expect(
      focusedComparisonIssue(
        opening,
        "The neighborhood library can also provide access to computers.",
      ),
    ).toContain("lend books");
    expect(
      focusedComparisonIssue(
        opening,
        "Lending books is just one thing a neighborhood library can do.",
      ),
    ).toBeUndefined();
    expect(
      focusedComparisonIssue(
        opening,
        "More than lending books, a neighborhood library can host community events.",
      ),
    ).toContain("open-ended");
    expect(
      focusedComparisonIssue(
        timetable,
        "The proposed renovation is expensive; a small change to the timetable may help.",
      ),
    ).toContain("expensive renovation");
    expect(
      focusedComparisonIssue(
        timetable,
        "More readers may benefit from a small timetable change than from a costly renovation.",
      ),
    ).toBeUndefined();
  });

  it("flags model tool markers while accepting literal markup from the source", () => {
    const original = "The drivers reviewed the route before leaving.";
    expect(reviewRewrite(original, "</tool_call>\n\n" + original)).toContain(
      "Protected output format. Return the rewritten prose without tool markers.",
    );
    const withMarker = original + "\n<tool_call>";
    expect(reviewRewrite(withMarker, withMarker)).toEqual([]);
  });

  it("keeps agreement to an earlier request separate from asking for something", () => {
    const source =
      "The museum asked if it could keep a scan and return the original. I said yes and asked for a copy of any notes about the picture.";
    expect(
      reviewRewrite(
        source,
        "The museum asked if it could keep a scan and return the original. I agreed to take a copy of any notes about the picture.",
      ),
    ).toContain(
      "Protected consent and request changed. Keep both the agreement and the separate request.",
    );
    expect(
      reviewRewrite(
        source,
        "The museum asked if it could keep a scan and return the original. I agreed and asked the museum to send me a copy of any notes about the picture.",
      ),
    ).toEqual([]);
  });

  it("keeps a criterion separate from an asserted result", () => {
    const source =
      "The useful measure is whether the library makes everyday life easier for the community it serves.";
    expect(
      focusedEvaluationIssue(
        source,
        "The library's impact on daily life is undeniable, as it simplifies the community's access to information.",
      ),
    ).toContain("criterion");
    expect(
      focusedEvaluationIssue(
        source,
        "Judge the library by how much easier it makes everyday life for the community it serves.",
      ),
    ).toBeUndefined();
  });

  it("protects distinct actions in a qualified contrast and removes an excerpt preamble", () => {
    const original =
      "Evening classes can help adults use online services, while quiet rooms give students somewhere to work when home is crowded.";
    const conflated =
      "Evening classes and quiet rooms can help adults and students access online services and work effectively when home is crowded.";
    expect(reviewRewrite(original, conflated).join(" ")).toContain(
      "Protected qualified claim changed",
    );
    expect(
      cleanLlmOutput("Here is the rewritten excerpt:\n\n" + original),
    ).toBe(original);
  });

  it("stops before generation and never substitutes a rule-based rewrite", async () => {
    const controller = new AbortController();
    controller.abort();
    const generate = vi.fn();
    await expect(
      runRewritePipeline({
        text: "Some source.",
        mode: "standard",
        signal: controller.signal,
        generate,
        onProgress: noop,
      }),
    ).rejects.toThrow("stopped");
    expect(generate).not.toHaveBeenCalled();
  });
});
