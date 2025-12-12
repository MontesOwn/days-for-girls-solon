import { Timestamp } from "firebase/firestore";

//Used for current inventory and for the select input in the doante and distribute forms
export interface ComponentItem {
  componentId: string;
  componentType: string;
  quantity: number;
}

//Used for the summary table when generating a report
export interface ComponentSummary {
  componentType: string;
  quantityDonated: number;
  quantityDistributed: number;
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

/*Used for both distributed and doanted inventory entry logs. If whoDonated is not null, it is a 
donated inventory log entry. If destination is not null, it is a distributed inventory log entry */
export interface InventoryEntry {
  entryId: string;
  entryDate: Timestamp;
  componentType: string;
  quantity: number;
  whoDonated?: string;
  destination?: string;
}

export interface SignUpEntry {
  entryId: string;
  eventId: string;
  fullName: string;
  email: string;
  comments?: string;
}

/* The Quill.js text editor creates a delta from it's contents. Storing the HTML is easier to create the card on the 
donate page, but the text editor needs the delta to populate the editor when editing existing content */
export interface DonatePageContent {
  delta: string;
  html: string;
  lastUpdated: Timestamp;
}
