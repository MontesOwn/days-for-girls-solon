import { Timestamp } from "firebase/firestore";
import {
  createButton,
  createTableRow,
  createMessage,
  createDeleteModal,
  storeMessage,
  createTable,
  openModal,
  closeModal,
  fixDate,
  capitalizeFirstLetter
} from "./modules/utils";
import {
  getEventById,
  deleteEvent,
  updateEvent,
  getSignUpEntriesForEventId,
  deleteSignUpEntry,
} from "./firebaseService";
import { initializeApp } from "./app";
import { SignUpEntry, Event } from "./models";
import { navigateTo } from "./modules/navigate";

//DOM Elements
const signUpEntriesCard = document.getElementById(
  "sign-up-entires-card",
) as HTMLElement;
const deleteEventCard = document.getElementById(
  "deleteEventCard",
) as HTMLElement;
const deleteEventButton = document.getElementById(
  "delete-button",
) as HTMLElement;
const editModalBackdrop = document.getElementById(
  "edit-event-backdrop",
) as HTMLElement;
const editEventModal = document.getElementById(
  "edit-event-modal",
) as HTMLFormElement;
const eventInfoCard = document.getElementById("event-info") as HTMLElement;

// Get event id from url
const urlParams = new URLSearchParams(window.location.search);
const idString: string | null = urlParams.get("id");
const eventId: string = idString ? idString : "";
//Create a null event element, to be loaded inside initAppLogic
let eventObject: Event | null = null;

function displayEventInfo(eventObject: Event) {
  //Clear the event info card if it already had event info
  eventInfoCard.innerHTML = "";
  //Add the event title
  const eventH2: HTMLElement = document.createElement("h2");
  const eventTitle: Text = document.createTextNode(eventObject["eventTitle"]);
  eventH2.appendChild(eventTitle);
  eventInfoCard.appendChild(eventH2);
  //Add the event time and date
  const eventDateAndTimeH3: HTMLElement = document.createElement("h3");
  const eventDateAndTime: Text = document.createTextNode(
    `${fixDate(eventObject["eventDate"], "longDate")} ${eventObject["eventTime"]}`,
  );
  eventDateAndTimeH3.appendChild(eventDateAndTime);
  eventInfoCard.appendChild(eventDateAndTimeH3);
  //Add the event location
  const eventLocationH3: HTMLElement = document.createElement("h3");
  const eventLocation: Text = document.createTextNode(
    eventObject["eventLocation"],
  );
  eventLocationH3.appendChild(eventLocation);
  eventInfoCard.appendChild(eventLocationH3);
  //Add the number of people attending the event
  const numberAttendingH3: HTMLElement = document.createElement("h3");
  const numberAttending: Text = document.createTextNode(
    `Number Attending: ${eventObject["numberAttending"]}`,
  );
  numberAttendingH3.appendChild(numberAttending);
  eventInfoCard.appendChild(numberAttendingH3);
  //Add the evetn description
  const eventDescriptionP: HTMLElement = document.createElement("p");
  const eventDescription: Text = document.createTextNode(
    eventObject["eventDescription"],
  );
  eventDescriptionP.appendChild(eventDescription);
  eventInfoCard.appendChild(eventDescriptionP);
  //Add the edit event button
  const buttonRow: HTMLElement = document.createElement("section");
  buttonRow.setAttribute("class", "button-row left");
  const editButton = createButton(
    "Edit Event Info",
    "button",
    "editButton",
    "primary",
    "edit_calendar",
  );
  //Event listener for the edit event button
  editButton.addEventListener("click", () => {
    //Open the edit event modal
    openModal(editModalBackdrop, editEventModal, "eventTitle");
  });
  buttonRow.appendChild(editButton);
  eventInfoCard.appendChild(buttonRow);
}

function resetInfo(eventObject: Event) {
  //Get event title input and set the value
  let eventTitleInput = document.getElementById(
    "eventTitle",
  ) as HTMLInputElement;
  eventTitleInput.value = eventObject["eventTitle"];
  //Get event date input, create a new date object, get the date, and set the value
  let eventDateInput = document.getElementById("eventDate") as HTMLInputElement;
  let eventDate: Date = eventObject["eventDate"].toDate();
  eventDateInput.value = eventDate.toISOString().split("T")[0];
  //Get event location input and set the value
  let eventLocationInput = document.getElementById(
    "eventLocation",
  ) as HTMLInputElement;
  eventLocationInput.value = eventObject["eventLocation"];
  //Get event time input and set the value
  let eventTimeInput = document.getElementById("eventTime") as HTMLInputElement;
  eventTimeInput.value = eventObject["eventTime"];
  //Get event description textarea and set the value
  let eventDescriptionInput = document.getElementById(
    "eventDescription",
  ) as HTMLInputElement;
  eventDescriptionInput.value = eventObject["eventDescription"];
}

async function editEventInfo() {
  //Create updating event message
  createMessage("Updating event data...", "edit-event-modal-message", "info");
  //Check if the eventObject is loaded
  if (!eventObject) {
    closeModal("edit-event-backdrop");
    createMessage(
      "Cannot update event. Please try reloading the page.",
      "main-message",
      "error",
    );
    return;
  }

  //Get the form data
  let formData: FormData = new FormData(editEventModal);
  //Create an object for the updated event
  let updatedEvent: Event = {
    eventId: eventId,
    eventTitle: "",
    eventDate: Timestamp.fromDate(new Date(0)),
    eventLocation: "",
    eventTime: "",
    eventDescription: "",
    numberAttending: 0,
  };
  //Validate the event title input
  let TitleValue = formData.get("eventTitle");
  if (TitleValue === null || TitleValue.toString().trim() === "") {
    createMessage(
      "Please enter the title of the event",
      "edit-event-modal-message",
      "error",
    );
    return;
  } else {
    updatedEvent["eventTitle"] = capitalizeFirstLetter(TitleValue.toString());
  }
  //Validate the event date input
  const dateValue = formData.get("eventDate");
  if (dateValue === null || dateValue === "") {
    createMessage(
      "Please enter the date of the event",
      "edit-event-modal-message",
      "error",
    );
    return;
  } else {
    //Converting dateValue to a js date object
    const jsDate = new Date(dateValue.toString());
    updatedEvent["eventDate"] = Timestamp.fromDate(jsDate);
  }
  //Validate event location input
  let locationValue = formData.get("eventLocation");
  if (locationValue === null || locationValue.toString().trim() === "") {
    createMessage(
      "Please enter the location of the event",
      "edit-event-modal-message",
      "error",
    );
    return;
  } else {
    updatedEvent["eventLocation"] = capitalizeFirstLetter(locationValue.toString());
  }
  //Validate event time input
  let timeValue = formData.get("eventTime");
  if (timeValue === null || timeValue.toString().trim() === "") {
    createMessage(
      "Please enter the time of the event",
      "edit-event-modal-message",
      "error",
    );
    return;
  } else {
    updatedEvent["eventTime"] = timeValue.toString();
  }
  //Get the event description from the textarea, validate, and turn it into a string
  let eventDescriptionValue = formData.get("eventDescription");
  if (
    eventDescriptionValue === null ||
    eventDescriptionValue.toString().trim() === ""
  ) {
    createMessage(
      "Please enter a description for the event",
      "edit-event-modal-message",
      "error",
    );
    return;
  } else {
    updatedEvent["eventDescription"] = eventDescriptionValue.toString();
  }
  try {
    //Try to update the event
    await updateEvent(eventId, updatedEvent);
    //If successful, close the modal
    closeModal("edit-event-backdrop");
    eventObject = updatedEvent;
    displayEventInfo(updatedEvent);
    createMessage(
      "The event was successfully updated",
      "main-message",
      "check_circle",
    );
  } catch (error: any) {
    createMessage(error, "edit-event-modal-message", "error");
  }
}

function addNewRow(newEntry: SignUpEntry, eventObject: Event) {
  //Create a new row for the table with the entry details
  const keysToDisplay = ["fullName", "email", "comments"];
  const idKeyName = "entryId";
  const newRow = createTableRow(newEntry, keysToDisplay, idKeyName, 4);
  const deleteButton = newRow.querySelector("button");
  if (deleteButton) {
    deleteButton.addEventListener("click", () => {
      //Create/open the modal and get the button row to add event lsiteners
      const buttonRow = createDeleteModal(
        newEntry,
        `Are you sure you want to delete this entry?`,
      );
      if (buttonRow) {
        const noButton = buttonRow.children[0];
        const yesButton = buttonRow.children[1];
        if (yesButton) {
          yesButton.addEventListener("click", async () => {
            //Close the delete modal
            closeModal("delete-item-backdrop");
            try {
              //Delete the sign up entry
              await deleteSignUpEntry(newEntry["entryId"]);
              //Create a message saying the sign up entry has been deleted
              createMessage(
                `Deleted entry from ${newEntry["fullName"]}`,
                "main-message",
                "delete",
              );
              //Remove the entry from the table
              newRow.remove();
              eventObject["numberAttending"] -= 1;
              displayEventInfo(eventObject);
            } catch (error: any) {
              createMessage(error, "main-message", "error");
            }
          });
        }
        if (noButton) {
          noButton.addEventListener("click", () => {
            closeModal("delete-item-backdrop");
          });
        }
      }
    });
  }
  return newRow;
}

function populateEntriesTable(
  eventObject: Event,
  eventSignUpEntries: SignUpEntry[],
) {
  if (eventSignUpEntries.length === 0) {
    let noEntriesP = document.createElement("p");
    let noEntriesText = document.createTextNode(
      `No one has signed up for ${eventObject["eventTitle"]} yet`,
    );
    noEntriesP.appendChild(noEntriesText);
    signUpEntriesCard.appendChild(noEntriesP);
  } else {
    const previousTableContainer = document.getElementById("table-container");
    if (previousTableContainer) previousTableContainer.remove();
    //Create the table
    const tableContainer = document.createElement("div");
    tableContainer.setAttribute("id", "entries-table-container");
    tableContainer.setAttribute("class", "table-container");
    const tableColumnHeaders: string[] = [
      "Name",
      "Email",
      "Comments",
      "Delete",
    ];
    const signUpTable = createTable("sign-up-table", tableColumnHeaders);
    let tableBody = eventSignUpEntries.reduce(
      (acc: HTMLElement, currentEntry: SignUpEntry) => {
        const newRow = addNewRow(currentEntry, eventObject);
        acc.appendChild(newRow);
        return acc;
      },
      document.createElement("tbody"),
    );
    signUpTable.appendChild(tableBody);
    tableContainer.appendChild(signUpTable);
    signUpEntriesCard.appendChild(tableContainer);
  }
}

async function initAppLogic() {
  //Check for event ID
  if (eventId === "") {
    //If the id is not in the url, store a message and redirect to the events page
    storeMessage(
      "Error loading event. Please try again.",
      "main-message",
      "error",
    );
    navigateTo("/events");
    return;
  }

  //Try to get the event once the app initialization is complete
  try {
    eventObject = await getEventById(eventId);
  } catch (error: any) {
    //If there is an error loading the event, store a message and redirect to the events page
    storeMessage(error, "main-message", "error");
    navigateTo("/events");
    return;
  }

  if (eventObject === null) {
    //If the eventObject is null, create a no event card
    createMessage("Could not find event", "main-message", "error");
    editEventModal.remove();
    signUpEntriesCard.remove();
    deleteEventCard.remove();
    let errorCard = document.createElement("section");
    errorCard.setAttribute("class", "card");
    let errorH2 = document.createElement("h2");
    let errorTite = document.createTextNode("Could not find event");
    errorH2.appendChild(errorTite);
    errorCard.appendChild(errorH2);
    let errorP = document.createElement("p");
    let errorMessage = document.createTextNode(
      "The event you were looking for does not exist or the url is incorrect. Please go back to the events page and try again.",
    );
    errorP.appendChild(errorMessage);
    errorCard.appendChild(errorP);
    let main = document.querySelector("main");
    if (main) main.appendChild(errorCard);
  } else {
    //Event found, load the event and set up event listeners
    resetInfo(eventObject);
    const signUpEntries = await getSignUpEntriesForEventId(eventId);
    populateEntriesTable(eventObject, signUpEntries);
    displayEventInfo(eventObject);
    const loadingCard = document.getElementById("loading");
    if (loadingCard) loadingCard.remove();
    eventInfoCard.classList.remove("hide");
    signUpEntriesCard.classList.remove("hide");
    deleteEventCard.classList.remove("hide");

    // Event listener for the delete button
    deleteEventButton.addEventListener("click", () => {
      const buttonRow = createDeleteModal(
        eventObject!,
        "Are you sure you want to delete this event?",
      );
      if (buttonRow) {
        const noButton = buttonRow.children[0];
        const yesButton = buttonRow.children[1];
        if (yesButton) {
          yesButton.addEventListener("click", async () => {
            //Close the delete modal
            closeModal("delete-item-backdrop");
            try {
              await deleteEvent(eventId);
              //Store the message saying the event was deleted. Will be displayed when redirected to the events page
              storeMessage(
                `Deleted event ${eventObject!["eventTitle"]} ${fixDate(eventObject!["eventDate"], "shortDate")}`,
                "main-message",
                "delete",
              );
              //Redirect to the events page
              navigateTo("/events");
            } catch (error: any) {
              createMessage(error, "main-message", "error");
            }
          });
        }
        if (noButton) {
          noButton.addEventListener("click", () => {
            closeModal("delete-item-backdrop");
          });
        }
      }
    });

    // Event listener to reset the form to the event data
    let resetFormButton = document.getElementById("reset") as HTMLElement;
    resetFormButton.addEventListener("click", (e) => {
      e.preventDefault();
      resetInfo(eventObject!);
    });

    // Event listener to close the edit event modal
    const cancelFormButton = document.getElementById("cancel") as HTMLElement;
    cancelFormButton.addEventListener("click", () => {
      closeModal("edit-event-backdrop");
    });

    // Event listener to submit the data to update the event
    editEventModal.addEventListener("submit", (e) => {
      e.preventDefault();
      editEventInfo();
    });
  }
}

initializeApp("Upcoming Events", "Manage Event").then(() => {
  //Run the logic to load the events page after the app initialization has finished
  initAppLogic();
});
