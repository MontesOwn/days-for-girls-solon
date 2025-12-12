import { FirebaseError, initializeApp } from "firebase/app";
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
} from "firebase/firestore";
import {
  ComponentItem,
  DonatePageContent,
  Event,
  InventoryEntry,
  SignUpEntry,
} from "./models.js";
import { db } from "./firebase.js";

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

function mapDocToComponent(docSnap: DocumentSnapshot<any>): ComponentItem {
  const data = docSnap.data() as Omit<ComponentItem, "componentId">;
  return {
    ...data,
    componentId: docSnap.id,
  } as ComponentItem;
}

function mapDocToInventoryEntry(
  docSnap: DocumentSnapshot<any>,
): InventoryEntry {
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
export async function getAllEvents(): Promise<Event[]> {
  try {
    const events: Event[] = [];
    const q = query(collection(db, "events"), orderBy("eventDate", "desc"));
    const querySnapshot = await getDocs(q);

    querySnapshot.forEach((doc) => {
      events.push(mapDocToEvent(doc));
    });
    return events;
  } catch (error) {
    console.error("Error fetching all events:", error);
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
/**
 * Helper function for seedIfEmptyInventoryLog() which creates placeholder log entires
 * @returns - A componet ID
 */
async function getOrCreateDummyComponentId(): Promise<string> {
  const inventoryRef = collection(db, "inventory");
  //Check if any component exists
  const q = query(inventoryRef, limit(1));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    //Return the ID of the first found component
    return querySnapshot.docs[0].id;
  }

  //Create a new dummy component since the inventory is empty
  const dummyComponent: Omit<ComponentItem, "componentId"> = {
    componentType:
      "Placeholder component. Please delete after adding a real component",
    quantity: 9999,
  };

  //Add the component and return the generated ID
  return addComponent(dummyComponent);
}

/**
 * Get all the components from the firestore
 * @returns - An array of components
 */
export async function getAllComponents(): Promise<ComponentItem[]> {
  try {
    //Create an emtpy arrray
    const components: ComponentItem[] = [];
    //Search for all docs in the inventory collection
    const q = query(collection(db, "inventory"));
    const querySnapshot = await getDocs(q);
    //Map the docs to component objects
    querySnapshot.forEach((doc) => {
      components.push(mapDocToComponent(doc));
    });
    return components;
  } catch (error) {
    console.error("Error fetching all components:", error);
    throw new Error("Failed to get inventory. Please try reloading the page.");
  }
}

/**
 * Get a component from the current inventory by its component ID
 * @param componentId
 * @returns
 */
export async function getComponentbyId(
  componentId: string,
): Promise<ComponentItem | null> {
  try {
    const docRef = doc(collection(db, "inventory"), componentId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return mapDocToComponent(docSnap);
    } else {
      console.warn("No such component found!");
      return null;
    }
  } catch (error) {
    console.error("Error fetching component:", error);
    throw new Error("Failed to get component. Please try reloading the page.");
  }
}

/**
 * Add a new component type to the inventory to track its current inventory count
 * @param newComponent - The new type of component to add to the inventory
 * @returns
 */
export async function addComponent(
  newComponent: Omit<ComponentItem, "componentId">,
): Promise<string> {
  try {
    const componentRef = collection(db, "inventory");
    //Use the componentType as the document ID
    const componentId = newComponent["componentType"];
    const docRef = doc(componentRef, componentId);

    const componentData: ComponentItem = {
      ...newComponent,
      componentId: componentId,
    };

    //Use setDoc to write the data with the specific componentType ID
    await setDoc(docRef, componentData as any);
    return componentId;
  } catch (error) {
    console.error("Error adding component:", error);
    if (error instanceof FirebaseError && error.code === "permission-denied") {
      throw new Error("Authorization Error: Only admins can add components.");
    } else {
      throw new Error(
        "Failed to update component. Please try reloading the page.",
      );
    }
  }
}

/**
 * Delete a component from the inventory. This will also delete all the inventory entry
 * logs for the component.
 * @param componentId - The ID of the component to delete from the inventory. This will also delete all the inventory entry
 * logs for the component
 */
export async function deleteComponent(componentId: string) {
  try {
    //Find all the log entries for the component
    const logRef = collection(db, "inventoryLog");
    const q = query(logRef, where("componentType", "==", componentId));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      //Delete all log entries in parallel
      const deletePromises = querySnapshot.docs.map((docSnap) =>
        deleteDoc(doc(logRef, docSnap.id)),
      );
      await Promise.all(deletePromises);
    }

    //Delete the component
    const docRef = doc(collection(db, "inventory"), componentId);
    await deleteDoc(docRef);
  } catch (error) {
    if (error instanceof FirebaseError && error.code === "permission-denied") {
      throw new Error(
        "Authorization Error: Only admins can delete components.",
      );
    } else {
      throw new Error(
        "Failed to delete component. Please try reloading the page.",
      );
    }
  }
}

/**
 * Create a donated and distributed entry log if the inventory log is empty so the app doesn't throw
 * any error when getFilteredLogEntries() is called
 */
export async function seedIfEmptyInventoryLog() {
  try {
    const logRef = collection(db, "inventoryLog");
    const q = query(logRef, limit(1));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      //Ensure a component exists to link the log entry to
      const componentId = await getOrCreateDummyComponentId();
      if (!componentId) {
        console.error("Failed to get or create a component ID for seeding.");
        return;
      }

      //Create a placeholder donated entry log
      const donationSeedEntry: Omit<InventoryEntry, "entryId"> = {
        entryDate: Timestamp.now(),
        componentType: componentId,
        quantity: 50,
        whoDonated:
          "Placeholder entry log. Please delete after adding a real log entry",
      };
      await addLogEntry(donationSeedEntry);

      //Create a distributed entry log
      const distributionSeedEntry: Omit<InventoryEntry, "entryId"> = {
        entryDate: Timestamp.now(),
        componentType: componentId,
        quantity: 10,
        destination:
          "Placeholder entry log. Please delete after adding a real log entry",
      };
      await addLogEntry(distributionSeedEntry);
    }
  } catch (error) {
    console.error("Error during inventory log seeding:", error);
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
export async function addLogEntry(
  newLogEntry: Omit<InventoryEntry, "entryId">,
): Promise<string> {
  //Used to update the quantity of the component
  let isIncrement: boolean;
  const componentId = newLogEntry.componentType;
  const additionalCount = newLogEntry.quantity;
  //Determine whether the log entry is a donation or distribution
  if (newLogEntry.whoDonated) {
    //Donation: Add to inventory
    isIncrement = true;
  } else if (newLogEntry.destination) {
    //Distribution: Subtract from inventory
    isIncrement = false;
  } else {
    console.warn(
      "Log entry type is not recognized (donation/distribution). Aborting.",
    );
    return "";
  }

  //Create a new document reference first to get its ID
  const newLogEntryRef = doc(collection(db, "inventoryLog"));
  const entryId = newLogEntryRef.id;

  try {
    //Using Firestore transactions to make sure the log entry is only added if it updates the component quantity
    await runTransaction(db, async (txn) => {
      const componentRef = doc(collection(db, "inventory"), componentId);
      const componentSnap = await txn.get(componentRef);

      if (!componentSnap.exists()) {
        throw new Error("Component not found in inventory.");
      }
      //Caculate updated component quantity
      const currentQuantity = componentSnap.data()?.quantity || 0;
      const changeValue = isIncrement ? additionalCount : additionalCount * -1;
      const newQuantity = currentQuantity + changeValue;
      if (newQuantity < 0) {
        //Prevent inventory from going negative
        throw new Error(
          `Please enter a quantity less than or equal to ${currentQuantity}`,
        );
      }
      //Update the component quantity
      txn.update(componentRef, { quantity: newQuantity });

      //Add the log entry
      txn.set(newLogEntryRef, {
        ...newLogEntry,
        entryId: entryId,
      });
    });
    return entryId;
  } catch (error) {
    console.error("Error adding inventory log entry:", error);
    throw error;
  }
}

/**
 * Delete an inventory log entry
 * @param entryId - The entry ID of the entry log to delete
 */
export async function deleteLogEntry(entryId: string) {
  try {
    //Using Firestore transactions to make sure the log entry is only deleted if it updates the component quantity
    await runTransaction(db, async (txn) => {
      //Document references
      const logEntryRef = doc(collection(db, "inventoryLog"), entryId);

      //Read the log entry to determine component and quantity
      const logEntrySnap = await txn.get(logEntryRef);

      if (!logEntrySnap.exists()) {
        console.warn(`Log entry ${entryId} not found.`);
        throw new Error("Error: Inventory entry does not exist.");
      }

      const logEntryToDelete = mapDocToInventoryEntry(logEntrySnap);
      const componentId = logEntryToDelete.componentType;
      const additionalCount = logEntryToDelete.quantity;

      let isReversalIncrement: boolean;
      if (logEntryToDelete.whoDonated) {
        //Donation log entry, reversal is decrement
        isReversalIncrement = false;
      } else if (logEntryToDelete.destination) {
        //Distribution log entry, reversal is increment
        isReversalIncrement = true;
      } else {
        //Log entry is unrecognizable, just delete it without inventory update
        txn.delete(logEntryRef);
        return;
      }

      const componentRef = doc(collection(db, "inventory"), componentId);
      const componentSnap = await txn.get(componentRef);

      if (!componentSnap.exists()) {
        //Component is already gone, proceed with log entry deletion
        txn.delete(logEntryRef);
        return;
      }

      const currentQuantity = componentSnap.data()?.quantity || 0;
      const changeValue = isReversalIncrement
        ? additionalCount
        : additionalCount * -1;
      const newQuantity = currentQuantity + changeValue;

      if (newQuantity < 0) {
        //Inventory would go negative upon reversal, indicating a major inventory error
        throw new Error(
          "Inventory inconsistency detected: Cannot reverse deletion as it would result in negative quantity for component.",
        );
      }

      //Reverse the quantity change in the main inventory
      txn.update(componentRef, { quantity: newQuantity });
      //Delete the log entry document
      txn.delete(logEntryRef);
    });
  } catch (error) {
    console.error(
      `Error deleting inventory log entry ${entryId} (Transaction aborted):`,
      error,
    );
    if (error instanceof FirebaseError && error.code === "permission-denied") {
      throw new Error(
        "Authorization Error: Only admins can delete inventory entired.",
      );
    } else {
      throw new Error(
        "Failed to delete inventory entry. Please try reloading the page.",
      );
    }
  }
}
