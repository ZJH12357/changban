export type PetMood = "idle" | "walk" | "look" | "sleep" | "greet" | "happy" | "alert";

export function PetAvatar({ mood = "idle" }: { mood?: PetMood }) {
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
