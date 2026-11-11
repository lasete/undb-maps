import type { Metadata } from "next";
import MapsApp from "@/components/MapsApp";

export const metadata: Metadata = { title: "UNDB Maps · Totem" };

export default function Totem() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[#0c0509]">
      <MapsApp variant="totem" />
    </div>
  );
}
