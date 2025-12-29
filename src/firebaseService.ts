import { FirebaseError } from "firebase/app";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentSnapshot,
  getDoc,
  getDocs,
  limit,
  orderBy,
  updateDoc,
  query,
  runTransaction,
  setDoc,
  Timestamp,
  where,
  QueryConstraint,
} from "firebase/firestore";
import {
  DonatePageContent,
  Event,
  InventoryEntry,
  SignUpEntry,
  Location,
  Component,
  LocationItem

} from "./models";
import { db } from "./firebase";

//Global Firebase Variables
declare const __app_id: string;
const appId: string =
  typeof __app_id !== "undefined" ? __app_id : "default-app-id";

/* Functions to map Doc to objects*/
function mapDocToDonateContent(
  docSnap: DocumentSnapshot<any>,
): DonatePageContent {
  return docSnap.data() as DonatePageContent;
}

function mapDocToEvent(docSnap: DocumentSnapshot<any>): Event {
  const data = docSnap.data() as Omit<Event, "eventId">;
  return {
    ...data,
    eventId: docSnap.id,
  } as Event;
}

function mapDocToSignUpEntry(docSnap: DocumentSnapshot<any>): SignUpEntry {
  const data = docSnap.data() as Omit<SignUpEntry, "entryId">;
  return {
    ...data,
    entryId: docSnap.id,
  } as SignUpEntry;
}

function mapDocToComponent(docSnap: DocumentSnapshot<any>): Component {
  const data = docSnap.data() as Omit<Component, "componentId">;
  return {
    ...data,
    componentId: docSnap.id,
  } as Component;
}

function mapDocToLocation(docSnap: DocumentSnapshot<any>): Location {
  const data = docSnap.data() as Omit<Location, "locationId">;
  return {
    ...data,
    locationId: docSnap.id,
  } as Location;
}

function mapDocToLocationItem(docSnap: DocumentSnapshot<any>): LocationItem {
  const data = docSnap.data() as LocationItem;
  return data as LocationItem;
}

function mapDocToInventoryEntry(docSnap: DocumentSnapshot<any>): InventoryEntry {
  const data = docSnap.data() as Omit<InventoryEntry, "entryId">;
  return {
    ...data,
    entryId: docSnap.id,
  } as InventoryEntry;
}

/* ---------------- Events ---------------- */
/**
 * Returns all the events stored in the firestore
 * @returns - An array of events
 */
export async function getAllEvents(futureOnly: boolean): Promise<Event[]> {
  try {
    const events: Event[] = [];
    const constraints: QueryConstraint[] = [];

    if (futureOnly) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      constraints.push(where("eventDate", ">=", today));
    }
    constraints.push(orderBy("eventDate", "desc"));
    const q = query(collection(db, "events"), ...constraints);
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((doc) => {
      events.push(mapDocToEvent(doc));
    });

    return events;
  } catch (error) {
    console.error("Error fetching events:", error);
    throw error;
  }
}

/**
 * Returns the event for the given eventId
 * @param eventId - The event ID
 * @returns - The event or null if no event matched eventId
 */
export async function getEventById(eventId: string): Promise<Event | null> {
  try {
    const docRef = doc(collection(db, "events"), eventId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return mapDocToEvent(docSnap);
    } else {
      console.warn("No such event document found!");
      return null;
    }
  } catch (error) {
    console.error("Error fetching event:", error);
    throw error;
  }
}

/**
 *
 * @param newEvent
 * @returns - The eventId that the firestore created
 */
export async function addEvent(
  newEvent: Omit<Event, "eventId">,
): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, "events"), newEvent);
    return docRef.id;
  } catch (error) {
    console.error("Error adding event:", error);
    if (error instanceof FirebaseError && error.code === "permission-denied") {
      throw new Error("Authorization Error: Only admins create events.");
    } else {
      throw new Error("Error adding event. Please try reloading the page.");
    }
  }
}

/**
 * Update an event in the firestore
 * @param eventId - The event ID of the event to update
 * @param updatedEvent - The event to update
 */
export async function updateEvent(eventId: string, updatedEvent: Event) {
  try {
    const docRef = doc(collection(db, "events"), eventId);
    const { eventId: _, ...updateData } = updatedEvent;
    await updateDoc(docRef, updateData as any);
  } catch (error) {
    console.error("Error updating event:", error);
    if (error instanceof FirebaseError && error.code === "permission-denied") {
      throw new Error("Authorization Error: Only admins update events.");
    } else {
      throw new Error("Error updating event. Please try reloading the page.");
    }
  }
}

/**
 * Delete an event from the firestore
 * @param eventId - The event ID of the event to delete
 */
export async function deleteEvent(eventId: string) {
  try {
    //Get all sign-up entries for the event
    const entriesToDelete = await getSignUpEntriesForEventId(eventId);
    //Delete each sign-up entry
    const deletePromises = entriesToDelete.map((entry) =>
      deleteSignUpEntry(entry.entryId),
    );
    await Promise.all(deletePromises);
    //Delete the event document itself
    const docRef = doc(collection(db, "events"), eventId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting event and related sign-up entries:", error);
    if (error instanceof FirebaseError && error.code === "permission-denied") {
      throw new Error("Authorization Error: Only admins delete events.");
    } else {
      throw new Error("Error deleting event. Please try reloading the page.");
    }
  }
}

/* ---------------- Event Sign Up ---------------- */
/**
 * Add a new sign up entry to the firestore
 * @param newEntry - The new sign up entry
 * @returns - The entry ID that the firestore created
 */
export async function addSignUpEntry(
  newEntry: Omit<SignUpEntry, "entryId">,
): Promise<string> {
  const eventId = newEntry.eventId;

  //Get document reference to get its ID.
  const newEntryRef = doc(collection(db, "signUpEntries"));
  const entryId = newEntryRef.id;

  try {
    //Using Firestore transaction to make sure the entry is only added if it can update the event's number attending
    await runTransaction(db, async (txn) => {
      const eventRef = doc(collection(db, "events"), eventId);

      //Read the Event document
      const eventSnap = await txn.get(eventRef);
      if (!eventSnap.exists()) {
        throw new Error(`Event with ID ${eventId} not found. Cannot sign up.`);
      }

      //Increment numberAttending in the Event
      const currentAttending = eventSnap.data()?.numberAttending || 0;
      const newAttending = currentAttending + 1;
      txn.update(eventRef, { numberAttending: newAttending });

      //Add the sign-up entry
      txn.set(newEntryRef, {
        ...newEntry,
        entryId: entryId,
      });
    });
    return entryId;
  } catch (error) {
    console.error("Error adding sign-up entry (Transaction aborted):", error);
    throw new Error(
      "Failed to sign up for the event. Please try reloading the page",
    );
  }
}

/**
 * Get all the sign up entries for an event
 * @param eventId - The event ID
 * @returns - An array of sign up entries
 */
export async function getSignUpEntriesForEventId(
  eventId: string,
): Promise<SignUpEntry[]> {
  try {
    const entries: SignUpEntry[] = [];
    //Create a query to filter documents where eventId matches the provided ID
    const q = query(
      collection(db, "signUpEntries"),
      where("eventId", "==", eventId),
    );
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((doc) => {
      entries.push(mapDocToSignUpEntry(doc));
    });

    return entries;
  } catch (error) {
    console.error(
      `Error fetching sign-up entries for event ${eventId}:`,
      error,
    );
    throw new Error(
      "Failed to get the sign up entries for this event. Please try reloading the page.",
    );
  }
}

/**
 * Delete a sign up entry from the firestore
 * @param entryId - The entry ID of the event to delete
 */
export async function deleteSignUpEntry(entryId: string) {
  try {
    //Using Firestore transaction to make sure the entry is only deleted if it can update the event's number attending
    await runTransaction(db, async (txn) => {
      const entryRef = doc(collection(db, "signUpEntries"), entryId);

      //Read the sign-up entry
      const entrySnap = await txn.get(entryRef);
      if (!entrySnap.exists()) {
        console.warn(`Sign-up entry ${entryId} not found.`);
        throw new Error("Error. Sign up entry does not exist.");
      }

      const entryToDelete = mapDocToSignUpEntry(entrySnap);
      const eventId = entryToDelete.eventId;
      const eventRef = doc(collection(db, "events"), eventId);
      //Read the Event document
      const eventSnap = await txn.get(eventRef);

      if (eventSnap.exists()) {
        //Decrement numberAttending in the Event document
        const currentAttending = eventSnap.data()?.numberAttending || 0;

        //Prevent negative numbers
        const newAttending = Math.max(0, currentAttending - 1);
        txn.update(eventRef, { numberAttending: newAttending });
      } else {
        console.warn(
          `Event ${eventId} not found when deleting sign-up entry ${entryId}. Only deleting entry.`,
        );
      }

      //Delete the sign-up entry document
      txn.delete(entryRef);
    });
  } catch (error) {
    console.error(
      `Error deleting sign-up entry ${entryId} (Transaction aborted):`,
      error,
    );
    //Only admins can delete sign up entries
    if (error instanceof FirebaseError && error.code === "permission-denied") {
      throw new Error(
        "Authorization Error: Only admins delete sign up entries.",
      );
    } else {
      throw new Error(
        "Error deleting sign up entry. Please try reloading the page.",
      );
    }
  }
}

/* ---------------- Donate Page Content (Single Document) ---------------- */
/**
 * Add content to the Donate page
 * @param html - The html code to be displayed on the page
 * @param delta - The delta object to populate the quill editor
 */
export async function addDonatePageContent(newPageContnte: DonatePageContent) {
  try {
    //Create a reference for the page content doc
    const docRef = doc(collection(db, "donatePage"), "donate-page-content");
    //Add the page content object
    await setDoc(docRef, newPageContnte);
  } catch (error) {
    console.error("Error adding donate page content:", error);
    //Only admins can add page content
    if (error instanceof FirebaseError && error.code === "permission-denied") {
      throw new Error(
        "Authorization Error: Only admins can update page content.",
      );
    } else {
      throw new Error(
        "Error updating page content. Please try reloading the page.",
      );
    }
  }
}

/**
 * Get the markdown content for the Donate page
 * @returns - The page content object
 */
export async function getDonatePageContent(): Promise<DonatePageContent | null> {
  try {
    //Get the reference to the content doc
    const docRef = doc(collection(db, "donatePage"), "donate-page-content");
    const docSnap = await getDoc(docRef);

    //If the doc exists, map it to the conent object
    if (docSnap.exists()) {
      return mapDocToDonateContent(docSnap);
    } else {
      console.warn(`No donate page content found at ID: donate-page-content'`);
      return null;
    }
  } catch (error) {
    console.error("Error fetching donate page content:", error);
    throw new Error(
      "Failed to load page content. Please try reloading the page.",
    );
  }
}

/**
 * Update the content of the Donate page
 * @param content - The updated page content
 */
export async function updateDonatePageContent(
  updatedPageContent: DonatePageContent,
) {
  try {
    //Get the reference to the content doc
    const docRef = doc(collection(db, "donatePage"), "donate-page-content");
    //Update the doc
    await updateDoc(docRef, updatedPageContent as any);
  } catch (error) {
    console.error("Error updating donate page content:", error);
    if (error instanceof FirebaseError && error.code === "permission-denied") {
      throw new Error(
        "Authorization Error: Only admins can update page content.",
      );
    } else {
      throw new Error(
        "Error updating page content. Please try reloading the page.",
      );
    }
  }
}

/* ---------------- Inventory ---------------- */
//------------Location---------------
export async function getListOfLocations(): Promise<Location[]> {
  try {
    const locations: Location[] = [];
    const q = query(collection(db, "locations"));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      locations.push(mapDocToLocation(doc));
    });
    return locations;
  } catch (error) {
    console.error("Error fetching all locations:", error);
    throw new Error("Failed to get locatoins. Please try reloading the page.");
  }
}

export async function getLocationById(locationId: string): Promise<Location | null> {
  try {
    const docRef = doc(collection(db, "locations"), locationId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return mapDocToLocation(docSnap);
    } else {
      console.warn("No such location found!");
      return null;
    }
  } catch (error) {
    console.error("Error fetching locatoin:", error);
    throw new Error("Failed to get location. Please try reloading the page.");
  }
}

export async function addNewLocation(newLocation: Omit<Location, "locationId">): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, "locations"), newLocation);
    return docRef.id;
  } catch (error) {
    console.error("Error adding location:", error);
    if (error instanceof FirebaseError && error.code === "permission-denied") {
      throw new Error("Authorization Error: Only admins create locations.");
    } else {
      throw new Error("Error adding location. Please try reloading the page.");
    }
  }
}

export async function renameLocation(locationId: string, newLocationName: string): Promise<void> {
  try {
    const locationRef = doc(db, "locations", locationId);
    await updateDoc(locationRef, {
      locationName: newLocationName
    });

  } catch (error) {
    console.error("Error updating location name:", error);

    if (error instanceof FirebaseError && error.code === "permission-denied") {
      throw new Error("Authorization Error: You do not have permission to rename this location.");
    } else {
      throw new Error("Failed to rename location. Please try reloading the page.");
    }
  }
}

export async function deleteLocation(locationId: string): Promise<void> {
  try {
    //Delete all locationItems that match locationId
    const locationItemsToDelete = await getAllItemsForLocation(locationId);
    const deletePromises = locationItemsToDelete.map((item: LocationItem) => deleteLocationItemByKeys(locationId, item['componentId']));
    await Promise.all(deletePromises);
    const docRef = doc(collection(db, "locations"), locationId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting location", error);
    if (error instanceof FirebaseError && error.code === "permission-denied") {
      throw new Error("Authorization Error: Only admins delete locations.");
    } else {
      throw new Error("Error deleting location. Please try reloading the page.");
    }
  }
}

//------------Component--------------
export async function getListOfComponents(): Promise<Component[]> {
  try {
    const locations: Component[] = [];
    const q = query(collection(db, "components"));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      locations.push(mapDocToComponent(doc));
    });
    return locations;
  } catch (error) {
    console.error("Error fetching all components:", error);
    throw new Error("Failed to get components. Please try reloading the page.");
  }
}

export async function addNewComponent(newComponent: Omit<Component, "componentId">): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, "components"), newComponent);
    return docRef.id;
  } catch (error) {
    console.error("Error adding copmonent:", error);
    if (error instanceof FirebaseError && error.code === "permission-denied") {
      throw new Error("Authorization Error: Only admins add components.");
    } else {
      throw new Error("Error adding component. Please try reloading the page.");
    }
  }
}

export async function remaneComponent(componentId: string, updatedComponentType: string): Promise<void> {
  try {
    const componentRef = doc(db, "components", componentId);
    await updateDoc(componentRef, {
      componentType: updatedComponentType
    });

  } catch (error) {
    console.error("Error updating component type:", error);

    if (error instanceof FirebaseError && error.code === "permission-denied") {
      throw new Error("Authorization Error: You do not have permission to rename this component.");
    } else {
      throw new Error("Failed to rename component. Please try reloading the page.");
    }
  }
}

export async function deleteComponent(componentId: string): Promise<void> {
  try {
    //Delete locationsItems that match componentId
    const locationItemsToDelete = await getAllItemsForComponent(componentId);
    const deletePromises = locationItemsToDelete.map((item: LocationItem) => deleteLocationItemByKeys(item['locationId'], item['componentId']));
    await Promise.all(deletePromises);
    const docRef = doc(collection(db, "locations"), componentId);
    await deleteDoc(docRef);
  } catch (error) {
    console.error("Error deleting copmonent", error);
    if (error instanceof FirebaseError && error.code === "permission-denied") {
      throw new Error("Authorization Error: Only admins delete components.");
    } else {
      throw new Error("Error deleting component. Please try reloading the page.");
    }
  }
}

//------------LocationItem--------------
export async function getAllLocationItems(): Promise<LocationItem[]> {
  try {
    const items: LocationItem[] = [];
    const q = query(collection(db, "locationItems"));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      items.push(mapDocToLocationItem(doc));
    });
    return items;
  } catch (error) {
    console.error("Error fetching all location items:", error);
    throw new Error("Failed to get current inventory. Please try reloading the page.");
  }
}

export async function getAllItemsForLocation(locationId: string): Promise<LocationItem[]> {
  try {
    const entries: LocationItem[] = [];
    const q = query(
      collection(db, "locationItems"),
      where("locationId", "==", locationId),
    );
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((doc) => {
      entries.push(mapDocToLocationItem(doc));
    });

    return entries;
  } catch (error) {
    console.error(
      `Error fetching items for location ${locationId}:`,
      error,
    );
    throw new Error(
      "Failed to get items this location. Please try reloading the page.",
    );
  }
}

export async function getAllItemsForComponent(componentId: string): Promise<LocationItem[]> {
  try {
    const entries: LocationItem[] = [];
    const q = query(
      collection(db, "locationItems"),
      where("componentId", "==", componentId),
    );
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((doc) => {
      entries.push(mapDocToLocationItem(doc));
    });

    return entries;
  } catch (error) {
    console.error(
      `Error fetching items for component ${componentId}:`,
      error,
    );
    throw new Error(
      "Failed to get items for this component. Please try reloading the page.",
    );
  }
}

export async function getLocationItem(locationId: string, componentId: string) {
  try {
    const itemsRef = collection(db, "locationItems");
    const q = query(
      itemsRef,
      where("locationId", "==", locationId),
      where("componentId", "==", componentId)
    );

    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    return {
      ...(doc.data() as LocationItem),
    };
  } catch (error) {
    console.error(
      "error fetching location item",
      error,
    );
    throw new Error(
      "Failed to the item. Please try reloading the page.",
    );
  }
}

export async function addIemToLocation(newLocationItem: LocationItem): Promise<String> {
  try {
    const docRef = await addDoc(collection(db, "locationItems"), newLocationItem);
    return docRef.id;
  } catch (error) {
    console.error("Error adding item to location:", error);
    if (error instanceof FirebaseError && error.code === "permission-denied") {
      throw new Error("Authorization Error: you are not an admin.");
    } else {
      throw new Error("Error adding item to location. Please try reloading the page.");
    }
  }
}

export async function updateItemQuantityForLocation(updatedLocationItem: LocationItem) {
  try {
    const itemsRef = collection(db, "locationItems");
    const q = query(
      itemsRef,
      where("locationId", "==", updatedLocationItem.locationId),
      where("componentId", "==", updatedLocationItem.componentId)
    );
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      throw new Error("Item not found at this location.");
    }

    const updatePromises = querySnapshot.docs.map((docSnapshot) =>
      updateDoc(doc(db, "locationItems", docSnapshot.id), {
        quantity: updatedLocationItem.quantity
      })
    );

    await Promise.all(updatePromises);

  } catch (error) {
    console.error("Error updating quantity:", error);
    if (error instanceof FirebaseError && error.code === "permission-denied") {
      throw new Error("Authorization Error: You do not have permission to update quantities.");
    } else {
      throw new Error("Failed to update quantity. Please try reloading the page.");
    }
  }
}

export async function deleteLocationItemByKeys(locationId: string, componentId: string): Promise<void> {
  try {
    const itemsRef = collection(db, "locationItems");
    const q = query(
      itemsRef,
      where("locationId", "==", locationId),
      where("componentId", "==", componentId)
    );
    const querySnapshot = await getDocs(q);

    const batchDeletes = querySnapshot.docs.map((docSnapshot) =>
      deleteDoc(doc(db, "locationItems", docSnapshot.id))
    );
    await Promise.all(batchDeletes);
  } catch (error) {
    console.error("Error during deletion:", error);
    throw new Error("Failed to remove the component from this location. Please try reloading the page.");
  }
}

/**
 * Get all the inventory entry logs
 * @returns - An array of inventory log entries
 */
export async function getAllLogEntires(): Promise<InventoryEntry[]> {
  try {
    const inventoryEntries: InventoryEntry[] = [];
    //Sort all entries by date
    const q = query(
      collection(db, "inventoryLog"),
      orderBy("entryDate", "desc"),
    );
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      inventoryEntries.push(mapDocToInventoryEntry(doc));
    });
    return inventoryEntries;
  } catch (error) {
    console.error("Error fetching all inventory log entries:", error);
    throw new Error(
      "Failed to load inventory log. Please try reloading the page.",
    );
  }
}

/**
 * Get all the donated log entires or all the distributed log entries
 * @param logType - Determines whether to return the donated log or the distributed log
 * @returns - An array of filtered inventory log entries
 */
export async function getFilteredLogEntries(
  logType: string,
): Promise<InventoryEntry[]> {
  try {
    let q;
    const logRef = collection(db, "inventoryLog");
    if (logType === "donated") {
      //If logType === donated, return all inventory log entries where "whoDonated" is NOT null/empty.
      q = query(
        logRef,
        where("whoDonated", ">", ""),
        orderBy("entryDate", "asc"),
        orderBy("whoDonated", "asc"),
      );
    } else if (logType === "distributed") {
      //If logType === distributed, return all inventory log entries where "destination" is NOT null/empty.
      q = query(
        logRef,
        where("destination", ">", ""),
        orderBy("entryDate", "asc"),
        orderBy("destination", "asc"),
      );
    } else {
      console.warn(
        `Invalid logType provided: ${logType}. Returning all log entries.`,
      );
      return getAllLogEntires();
    }
    const inventoryEntries: InventoryEntry[] = [];
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      inventoryEntries.push(mapDocToInventoryEntry(doc));
    });
    return inventoryEntries;
  } catch (error) {
    console.error(
      `Error fetching filtered inventory log entries for type ${logType}:`,
      error,
    );
    throw new Error(
      `Failed to load ${logType} inventory log. Please try reloading the page.`,
    );
  }
}

/**
 * Add a new inventory log entry
 * @param newLogEntry - The inventory entry log to add
 * @returns - The entry ID
 */
export async function addLogEntry(newLogEntry: Omit<InventoryEntry, "entryId">): Promise<string> {
  try {
    const docRef = await addDoc(collection(db, "inventoryLog"), newLogEntry);
    return docRef.id;
  } catch (error: any) {
    console.error(error);
    throw new Error("Error submitting inventory log entry.")
  }
}

/**
 * Delete an inventory log entry
 * @param entryId - The entry ID of the entry log to delete
 */
export async function deleteLogEntry(entryId: string) {
  try {
   const docRef = doc(collection(db, "inventoryLog"), entryId);
   await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting log entry ${entryId}:`, error);

    if (error instanceof FirebaseError && error.code === "permission-denied") {
      throw new Error("Authorization Error: Only admins can delete inventory entries.");
    } else if (error instanceof Error) {
      throw error;
    } else {
      throw new Error("Failed to delete inventory entry. Please try reloading the page.");
    }
  }
}