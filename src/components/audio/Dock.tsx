"use client";

import { useEffect } from "react";
import { useAudio } from "./AudioProvider";

export function Dock({ id }: { id: string }) {
  const { dock } = useAudio();
  useEffect(() => {
    dock(id);
    return () => dock(null);
  }, [dock, id]);
  return null;
}
