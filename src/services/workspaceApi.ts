import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
} from 'firebase/firestore';
import { auth, db } from './firebase';

export interface GoogleDocSummary {
  id: string;
  name: string;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface GoogleCalendarEventSummary {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
}

export type WorkspaceResourceType = 'doc' | 'sheet' | 'calendar_event';

export interface SavedWorkspaceLink {
  id: string;
  resourceType: WorkspaceResourceType;
  externalId: string;
  title: string;
  url: string;
  folderTag?: string;
  notes?: string | null;
  linkedByUid?: string;
  linkedByName: string;
  createdAt: string;
}

export async function workspaceFetch<T>(url: string, accessToken: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (res.status === 204) {
    return {} as T;
  }
  const data = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(data.error?.message || `Error ${res.status} al consultar Google Workspace.`);
  }
  return data;
}

export async function listRecentGoogleDocs(accessToken: string): Promise<GoogleDocSummary[]> {
  const q = encodeURIComponent("mimeType='application/vnd.google-apps.document' and trashed=false");
  const fields = encodeURIComponent('files(id,name,modifiedTime,webViewLink)');
  const data = await workspaceFetch<{ files?: GoogleDocSummary[] }>(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=modifiedTime desc&pageSize=20`,
    accessToken,
  );
  return data.files || [];
}

interface DocsParagraphElement {
  textRun?: { content?: string };
}

interface DocsStructuralElement {
  endIndex?: number;
  paragraph?: { elements?: DocsParagraphElement[] };
}

export async function readGoogleDocText(
  accessToken: string,
  documentId: string,
): Promise<{ title: string; text: string; endIndex: number }> {
  const docData = await workspaceFetch<{
    title?: string;
    body?: { content?: DocsStructuralElement[] };
  }>(`https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}`, accessToken);

  const elements = docData.body?.content || [];
  let text = '';
  let maxIndex = 1;
  for (const el of elements) {
    if (typeof el.endIndex === 'number' && el.endIndex > maxIndex) {
      maxIndex = el.endIndex;
    }
    if (el.paragraph?.elements) {
      for (const run of el.paragraph.elements) {
        if (run.textRun?.content) {
          text += run.textRun.content;
        }
      }
    }
  }
  return {
    title: docData.title || 'Documento sin título',
    text: text.trim(),
    endIndex: maxIndex,
  };
}

export async function createGoogleDoc(
  accessToken: string,
  title: string,
  initialBody: string,
): Promise<{ documentId: string; title: string; url: string }> {
  const created = await workspaceFetch<{ documentId: string; title: string }>(
    'https://docs.googleapis.com/v1/documents',
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({ title: title.trim() }),
    },
  );

  if (initialBody.trim()) {
    await workspaceFetch(
      `https://docs.googleapis.com/v1/documents/${encodeURIComponent(created.documentId)}:batchUpdate`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: `${initialBody.trim()}\n`,
              },
            },
          ],
        }),
      },
    );
  }

  return {
    documentId: created.documentId,
    title: created.title,
    url: `https://docs.googleapis.com/document/d/${created.documentId}/edit`,
  };
}

export async function appendTextToGoogleDoc(
  accessToken: string,
  documentId: string,
  textToAppend: string,
): Promise<void> {
  const current = await readGoogleDocText(accessToken, documentId);
  const insertIndex = Math.max(1, current.endIndex - 1);
  await workspaceFetch(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(documentId)}:batchUpdate`,
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: { index: insertIndex },
              text: `\n${textToAppend.trim()}\n`,
            },
          },
        ],
      }),
    },
  );
}

export async function listGoogleCalendarEvents(
  accessToken: string,
): Promise<GoogleCalendarEventSummary[]> {
  const nowIso = encodeURIComponent(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  const data = await workspaceFetch<{ items?: GoogleCalendarEventSummary[] }>(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&orderBy=startTime&timeMin=${nowIso}&maxResults=25`,
    accessToken,
  );
  return data.items || [];
}

export async function createGoogleCalendarEvent(
  accessToken: string,
  input: {
    summary: string;
    description?: string;
    location?: string;
    startIso: string;
    endIso: string;
  },
): Promise<GoogleCalendarEventSummary> {
  return workspaceFetch<GoogleCalendarEventSummary>(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    accessToken,
    {
      method: 'POST',
      body: JSON.stringify({
        summary: input.summary.trim(),
        description: input.description?.trim() || undefined,
        location: input.location?.trim() || 'Flandes, Tolima',
        start: {
          dateTime: new Date(input.startIso).toISOString(),
          timeZone: 'America/Bogota',
        },
        end: {
          dateTime: new Date(input.endIso).toISOString(),
          timeZone: 'America/Bogota',
        },
      }),
    },
  );
}

export async function deleteGoogleCalendarEvent(
  accessToken: string,
  eventId: string,
): Promise<void> {
  await workspaceFetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    accessToken,
    { method: 'DELETE' },
  );
}

export async function fetchSavedWorkspaceLinks(): Promise<SavedWorkspaceLink[]> {
  const q = query(collection(db, 'workspace_links'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<SavedWorkspaceLink, 'id'>),
  }));
}

export async function saveWorkspaceLinkToServer(payload: {
  resourceType: WorkspaceResourceType;
  externalId: string;
  title: string;
  url: string;
  folderTag?: string;
  notes?: string;
}): Promise<SavedWorkspaceLink> {
  const current = auth.currentUser;
  if (!current) {
    throw new Error('Debes iniciar sesión para vincular recursos.');
  }
  const newItem = {
    resourceType: payload.resourceType,
    externalId: payload.externalId.trim().slice(0, 255),
    title: payload.title.trim().slice(0, 240),
    url: payload.url.trim().slice(0, 600),
    ...(payload.folderTag?.trim() ? { folderTag: payload.folderTag.trim().slice(0, 40) } : {}),
    ...(payload.notes?.trim() ? { notes: payload.notes.trim().slice(0, 1000) } : {}),
    linkedByUid: current.uid,
    linkedByName: current.displayName || current.email || 'Consejero',
    createdAt: new Date().toISOString(),
  };
  const ref = await addDoc(collection(db, 'workspace_links'), newItem);
  return { id: ref.id, ...newItem };
}

export async function deleteWorkspaceLinkFromServer(id: string): Promise<void> {
  await deleteDoc(doc(db, 'workspace_links', id));
}
