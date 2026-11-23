const BOUNDED_CLAUSE =
  /^(\S[^,;.!?]{4,125}) (because|when|if|unless) (\S[^,;.!?]{4,125})\.$/i;
const OPEN_ENDED_ABILITY =
  /^((?:A|An|The) [\p{L}][\p{L} '-]{1,70}) can do more than ([\p{L}][\p{L} '-]{2,70})\.$/u;
export const QUALIFIED_COMPARISON =
  /^((?:A|An|The) [\p{L}][\p{L} '-]{2,80}) (may|might|can|could) (help|benefit|reach|serve) (more|fewer) ([\p{L}][\p{L} '-]{2,45}) than ((?:a|an|the) [\p{L}][\p{L} '-]{2,80})\.$/u;
const USEFUL_MEASURE = /^The useful measure is whether (\S[^.!?]+)\.$/i;
const ON_ITS_OWN =
  /^((?:A|An|The) [^,;.!?]{2,75} (?:will|can|could|may|might|does) (?:not )?(?:solve|fix|address|resolve|prevent) [^,;.!?]{2,75}) on its own\.$/;

const SHARED_SPACE =
  /^((?:It gives|They give) [\p{L}]+(?: [\p{L}]+){0,2}) a place to ([^.!?;]+)\.$/u;
const PARALLEL_BENEFITS =
  /^((The|A|An|Evening|Morning|Afternoon|Weekend|Online) [\p{L}][\p{L} -]{1,60} (?:can|could|may|might) (?:help|give|offer|provide) [^,.!?;]+), while ([\p{Ll}][\p{L} -]{1,60} (?:gives?|offers?|provides?) [^,.!?;]+)\.$/u;

/** Restructure a qualified benefit while preserving the two exact claims. */
export function restructureQualifiedBenefit(text: string): string | undefined {
  const shared = text.match(SHARED_SPACE);
  if (shared) return `${shared[1]} somewhere to ${shared[2]}.`;
  const parallel = text.match(PARALLEL_BENEFITS);
  if (parallel) {
    const [, main, opening, contrast] = parallel;
    return `While ${contrast}, ${opening!.toLowerCase()}${main!.slice(opening!.length)}.`;
  }
}

function lowerArticle(text: string): string {
  return text.replace(/^(?:A|An|The)\b/, (article) => article.toLowerCase());
}

/** Reorder clauses with explicit, unambiguous relationships. Leave other prose to the model. */
export function restructureFromSource(text: string): string | undefined {
  const ability = text.match(OPEN_ENDED_ABILITY);
  if (ability) {
    const [, subject, activity] = ability;
    if (!/\b(?:and|or|not|never)\b/i.test(activity!))
      return `${subject} can ${activity}, among other things.`;
  }

  const comparison = text.match(QUALIFIED_COMPARISON);
  if (comparison) {
    const [, first, modality, action, direction, group, second] = comparison;
    if (
      ![first, group, second].some((phrase) =>
        /\b(?:their|its|his|her|our|my|your|own|and|or)\b/i.test(phrase!),
      )
    ) {
      const opening = second![0]!.toUpperCase() + second!.slice(1);
      return `${opening} ${modality} ${action} ${direction === "more" ? "fewer" : "more"} ${group} than ${lowerArticle(first!)}.`;
    }
  }

  const measure = text.match(USEFUL_MEASURE);
  if (measure)
    return `A useful way to judge the result is to ask whether ${measure[1]}.`;

  const alone = text.match(ON_ITS_OWN);
  if (
    alone &&
    !/\b(?:and|or|because|when|if|unless|although|while)\b/i.test(alone[1]!)
  )
    return `On its own, ${lowerArticle(alone[1]!)}.`;

  const condition = text.match(BOUNDED_CLAUSE);
  if (condition) {
    const [, main, connective, dependent] = condition;
    const markers = text.match(
      /\b(?:because|when|if|unless|while|although|and|or)\b/gi,
    );
    if (
      markers?.length === 1 &&
      /^(?:A|An|The|I)\b/.test(main!) &&
      !/\b(?:not|never|no|only|just)\b|n['’]t\b/i.test(main!)
    ) {
      const opening = connective![0]!.toUpperCase() + connective!.slice(1);
      return `${opening} ${dependent}, ${lowerArticle(main!)}.`;
    }
  }
}
