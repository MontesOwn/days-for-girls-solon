import { Timestamp } from "firebase/firestore";

export interface Location {
  locationId: string;
  locationName: string;
  external: boolean;
}

export interface Component {
  componentId: string;
  componentType: string;
}

export interface LocationItem {
  locationId: string;
  locationName: string;
  componentId: string;
  componentType: string;
  quantity: number;
}

export interface ComponentSummary {
  componentId: string;
  componentType: string;
  quantityDonated: number;
  quantityDistributed: number;
}

export interface InventoryEntry {
  entryId: string;
  entryDate: Timestamp;
  componentId: string;
  componentType: string;
  locationId: string;
  locationName: string;
  quantity: number;
  whoDonated?: string;
  destination?: string;
  external: boolean;
}

export interface Event {
  eventId: string;
  eventTitle: string;
  eventDate: Timestamp;
  eventLocation: string;
  eventTime: string;
  eventDescription: string;
  numberAttending: number;
}

export interface SignUpEntry {
  entryId: string;
  eventId: string;
  fullName: string;
  email: string;
  comments?: string;
}

export interface DonatePageContent {
  delta: string;
  html: string;
  lastUpdated: Timestamp;
}
