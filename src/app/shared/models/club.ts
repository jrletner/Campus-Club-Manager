import { EventItem } from './event-item';
import { Member } from './member';

export interface Club {
  id: string;
  name: string;
  capacity: number;
  members: Member[];
  events: EventItem[];
}

export function seatsLeft(club: Club): number {
  return Math.max(0, club.capacity - club.members.length);
}

export function percentFull(club: Club): number {
  if (club.capacity <= 0) return 0;
  return Math.min(100, Math.round(club.members.length / club.capacity));
}

export function toPlainClub(c: Club): Club {
  return {
    id: c.id,
    name: c.name,
    capacity: c.capacity,
    // For each member, build an object
    members: c.members.map((m) => ({ id: m.id, name: m.name })),
    // For each event, build an object
    events: c.events.map((e) => ({
      id: e.id,
      title: e.title,
      dateIso: e.dateIso,
      capacity: e.capacity,
      description: e.description,
    })),
  };
}
