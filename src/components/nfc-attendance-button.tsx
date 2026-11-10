import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/kit';
import { useNfcAction } from '@/hooks/use-nfc-action';
import { api } from '@/lib/api';
import { readNfcCard } from '@/lib/nfc';
import type { AttendanceRecord } from '@/lib/types';

interface NfcAttendanceResult {
  student: { id: number; full_name: string };
  attendance: AttendanceRecord;
  already_recorded: boolean;
}

export function NfcAttendanceButton({
  classroomId,
  date,
  startTime,
  disabled,
  onRecorded,
  onBusyChange,
}: {
  classroomId: number;
  date: string;
  startTime: string;
  disabled: boolean;
  onRecorded: (studentId: number, attendance: AttendanceRecord) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const action = useNfcAction();
  const [message, setMessage] = useState('');
  const validTime = /^([01]\d|2[0-3]):[0-5]\d$/.test(startTime);

  useEffect(() => {
    onBusyChange(action.busy);
    return () => onBusyChange(false);
  }, [action.busy, onBusyChange]);

  async function read() {
    setMessage('');
    await action.run(async (signal, progress) => {
      progress('Aproxime o cartão do estudante do celular.');
      const token = await readNfcCard(signal);
      if (signal.aborted) return;
      progress('Salvando presença…');
      const result = await api<NfcAttendanceResult>('/attendances/nfc', {
        method: 'POST',
        body: { token, classroom_id: classroomId, date, start_time: startTime },
      });
      if (signal.aborted) return;
      onRecorded(result.student.id, result.attendance);
      setMessage(
        result.already_recorded
          ? `${result.student.full_name}: comparecimento já registrado. O registro existente foi mantido.`
          : `${result.student.full_name}: presença salva com sucesso.`
      );
    });
  }

  if (Platform.OS === 'web')
    return (
      <ThemedText type="caption" themeColor="textSecondary">
        Para registrar por NFC, use o app instalado em um celular com NFC. A chamada manual continua
        disponível aqui.
      </ThemedText>
    );
  return (
    <>
      <Button
        label="Ler cartão NFC"
        variant="secondary"
        onPress={read}
        disabled={disabled || !validTime}
        loading={action.busy}
      />
      {!validTime ? (
        <ThemedText type="caption" themeColor="textSecondary">
          Informe a hora de início da aula para registrar por NFC.
        </ThemedText>
      ) : null}
      <ThemedText type="caption" themeColor="textSecondary">
        A presença lida por NFC é salva imediatamente na turma e data selecionadas. A marcação
        manual continua disponível.
      </ThemedText>
      {action.busy ? (
        <>
          <ThemedText type="small" accessibilityLiveRegion="polite">
            {action.stage}
          </ThemedText>
          <Button label="Cancelar leitura" variant="secondary" onPress={action.cancel} />
        </>
      ) : null}
      {action.error ? (
        <ThemedText type="small" themeColor="danger" accessibilityLiveRegion="polite">
          {action.error}
        </ThemedText>
      ) : null}
      {message ? (
        <ThemedText type="small" themeColor="success" accessibilityLiveRegion="polite">
          {message}
        </ThemedText>
      ) : null}
    </>
  );
}
