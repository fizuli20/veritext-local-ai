import Link from "next/link";
export default function VerifyPage() {
  return (
    <main className="max-w-xl mx-auto p-8 space-y-5">
      <h1 className="text-2xl">
        Draft signatures do not certify human authorship
      </h1>
      <p>
        The previous “Proof-of-Human” feature has been retired. A local
        cryptographic signature can show that text matches a signed document. It
        cannot show who wrote it, whether AI was used, or whether typing
        telemetry was fabricated.
      </p>
      <p>
        Old certificates should not be used as evidence of human authorship.
        Existing signing utilities remain available in the source for technical
        reference.
      </p>
      <Link className="underline" href="/">
        Return to the writing editor
      </Link>
    </main>
  );
}
