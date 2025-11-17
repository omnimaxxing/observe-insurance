export type TranscriptEntry = {
  role: "caller" | "agent" | "system";
  content: string;
  timestamp: string;
};

export type CallSession = {
  callSid: string;
  streamSid?: string;
  startedAt: string;
  updatedAt: string;
  metadata: {
    from?: string;
    to?: string;
    direction?: string;
    status?: string;
    digits?: string;
    [key: string]: string | undefined;
  };
  auth: {
    status: "unknown" | "authenticated" | "failed";
    customerId?: string;
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    verifiedAt?: string;
  };
  transcript: TranscriptEntry[];
};

const globalForSessions = globalThis as unknown as {
  __callSessionStore__?: Map<string, CallSession>;
};

const sessions: Map<string, CallSession> =
  globalForSessions.__callSessionStore__ ?? new Map<string, CallSession>();

globalForSessions.__callSessionStore__ = sessions;

const nowIso = () => new Date().toISOString();

const createDefaultSession = (callSid: string): CallSession => ({
  callSid,
  startedAt: nowIso(),
  updatedAt: nowIso(),
  metadata: {},
  auth: {
    status: "unknown",
  },
  transcript: [],
});

export function getCallSession(callSid: string) {
  return sessions.get(callSid);
}

export function upsertCallSession(
  callSid: string,
  updater: (session: CallSession) => CallSession,
) {
  const existing = sessions.get(callSid) ?? createDefaultSession(callSid);
  const draft = structuredClone(existing);
  const updated = updater(draft);

  updated.callSid = callSid;
  updated.startedAt = existing.startedAt ?? updated.startedAt ?? nowIso();
  updated.updatedAt = nowIso();

  updated.metadata = {
    ...existing.metadata,
    ...updated.metadata,
  };

  if (!updated.auth) {
    updated.auth = existing.auth;
  } else {
    updated.auth = {
      status: updated.auth.status ?? existing.auth.status,
      customerId: updated.auth.customerId ?? existing.auth.customerId,
      firstName: updated.auth.firstName ?? existing.auth.firstName,
      lastName: updated.auth.lastName ?? existing.auth.lastName,
      phoneNumber: updated.auth.phoneNumber ?? existing.auth.phoneNumber,
      verifiedAt: updated.auth.verifiedAt ?? existing.auth.verifiedAt,
    };
  }


  updated.transcript = updated.transcript ?? existing.transcript;

  sessions.set(callSid, updated);
  return updated;
}

export function appendSessionTranscript(callSid: string, entry: TranscriptEntry) {
  return upsertCallSession(callSid, (session) => ({
    ...session,
    transcript: [...session.transcript, entry],
  }));
}

export function setSessionAuth(
  callSid: string,
  auth: CallSession["auth"],
) {
  return upsertCallSession(callSid, (session) => ({
    ...session,
    auth,
  }));
}

export function clearCallSession(callSid: string) {
  sessions.delete(callSid);
}

export function listActiveSessions() {
  return Array.from(sessions.values());
}
