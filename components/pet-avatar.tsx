"use client";
import { useCallback, useEffect, useRef } from "react";
import type { PetCompanion } from "@/lib/pet";
export type PetMood = "idle" | "walk" | "look" | "stretch" | "sleep" | "greet" | "happy" | "alert";

function SvgPetAvatar({ mood, paused, companion }: { mood: PetMood; paused: boolean; companion: "cat" | "dog" }) {
  const object = useRef<HTMLObjectElement>(null);
  const sync = useCallback(() => {
    const root = object.current?.contentDocument?.documentElement;
    if (root?.localName === "svg") {
      root.dataset.state = mood;
      root.dataset.paused = String(paused || document.hidden);
    }
  }, [mood, paused]);
  useEffect(() => { sync(); document.addEventListener("visibilitychange", sync); return () => document.removeEventListener("visibilitychange", sync); }, [sync]);
  return <span className={`cat-avatar ${companion}-avatar`} aria-hidden="true"><object ref={object} type="image/svg+xml" data={`/pets/${companion}.svg`} onLoad={sync} tabIndex={-1} aria-hidden="true"><img src={`/pets/${companion}.svg`} alt="" draggable={false}/></object></span>;
}

export function PetAvatar({ mood = "idle", companion = "rabbit", paused = false }: { mood?: PetMood; companion?: PetCompanion; paused?: boolean }) {
  if (companion === "cat" || companion === "dog") return <SvgPetAvatar companion={companion} mood={mood} paused={paused}/>;
  return <span className={`pet-avatar pet-${mood}`} aria-hidden="true">
    <span className="pet-shadow" />
    <span className="pet-tail" />
    <span className="pet-body"><span className="pet-belly" /></span>
    <span className="pet-foot pet-foot-left" /><span className="pet-foot pet-foot-right" />
    <span className="pet-arm pet-arm-left" /><span className="pet-arm pet-arm-right" />
    <span className="pet-head">
      {/* Kenney Animal Pack Remastered, CC0. See public/pets/KENNEY-LICENSE.txt. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/pets/rabbit.png" width="129" height="176" alt="" draggable={false} />
      <span className="pet-eyelid pet-eyelid-left" /><span className="pet-eyelid pet-eyelid-right" />
    </span>
    <span className="pet-scarf" /><span className="pet-scarf-end" />
    <span className="pet-spark">{mood === "sleep" ? "z Z" : mood === "happy" ? "♥" : mood === "alert" ? "!" : mood === "greet" ? "✦" : ""}</span>
  </span>;
}
