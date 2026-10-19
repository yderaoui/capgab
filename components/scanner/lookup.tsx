"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Clipboard, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { validMint } from "@/lib/solana";
export function Lookup({ large = false }: { large?: boolean }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validMint(value.trim())) {
      setError("Enter a valid Solana mint address.");
      return;
    }
    router.push(`/token/${value.trim()}`);
  }
  return (
    <div className={large ? "lookup large" : "lookup"}>
      <form onSubmit={submit}>
        <Search size={19} />
        <label className="sr-only" htmlFor={large ? "hero-mint" : "scan-mint"}>
          Solana token mint address
        </label>
        <input
          id={large ? "hero-mint" : "scan-mint"}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
          }}
          placeholder="Paste a Solana token address"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          className="paste-button"
          aria-label="Paste address"
          onClick={async () => {
            try {
              setValue(await navigator.clipboard.readText());
            } catch {
              setError(
                "Clipboard access unavailable. Paste the address manually.",
              );
            }
          }}
        >
          <Clipboard size={15} />
        </button>
        <Button type="submit">
          Scan token
          <ArrowRight size={15} />
        </Button>
      </form>
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
