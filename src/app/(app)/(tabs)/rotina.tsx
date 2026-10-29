import { useState } from "react";

import { ThemedText } from "@/components/themed-text";
import { Screen, SectionTitle, Segmented } from "@/components/ui/kit";
import { WorkSelector } from "@/components/work-selector";
import { AttendanceTab } from "@/features/rotina/attendance-tab";
import { LessonsTab } from "@/features/rotina/lessons-tab";
import { UniformTab } from "@/features/rotina/uniform-tab";

type Section = "attendance" | "uniform" | "lessons";

/** Etapa 2 do PDF — rotina diária: frequência, checklist de fardamento/calçado e aulas. */
export default function RoutineScreen() {
  const [section, setSection] = useState<Section>("attendance");

  return (
    <Screen>
      <ThemedText type="heading">Rotina diária</ThemedText>
      <WorkSelector />
      <Segmented
        value={section}
        onChange={setSection}
        options={[
          { value: "attendance", label: "Frequência" },
          { value: "uniform", label: "Fardamento" },
          { value: "lessons", label: "Aulas" },
        ]}
      />
      <SectionTitle>
        {section === "attendance"
          ? "Presentes, ausentes e atrasos"
          : section === "uniform"
            ? "Fardamento e calçado"
            : "Registro das aulas"}
      </SectionTitle>
      {section === "attendance" ? (
        <AttendanceTab />
      ) : section === "uniform" ? (
        <UniformTab />
      ) : (
        <LessonsTab />
      )}
    </Screen>
  );
}
