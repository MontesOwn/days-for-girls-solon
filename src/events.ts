import { initializeApp } from "./app.js";
import { createMessage, fixDate } from "./utils.js";
import { getAllEvents } from "./firebaseService.js";
import { Event } from "./models.js";
import { auth } from "./firebase.js";
import { getUserRole } from "./authService.js";

//DOM elements
let main = document.getElementById("maincontent") as HTMLElement;

function addEventToPage(eventData: Event, userRole: string) {
  //Create a new event article to add to the accumulator
  let newEvent: HTMLElement = document.createElement("article");
  newEvent.setAttribute("id", eventData["eventId"].toString());
  newEvent.setAttribute("class", "card");
  //Add the event title
  let eventH3: HTMLElement = document.createElement("h3");
  let eventTitle: Text = document.createTextNode(eventData["eventTitle"]);
  eventH3.appendChild(eventTitle);
  newEvent.appendChild(eventH3);
  //Add the date and time of the event
  let eventDateAndTimeH4: HTMLElement = document.createElement("h4");
  let eventDateAndTime: Text = document.createTextNode(
    `${fixDate(eventData["eventDate"], "longDate")} ${eventData["eventTime"]}`,
  );
  eventDateAndTimeH4.appendChild(eventDateAndTime);
  newEvent.appendChild(eventDateAndTimeH4);
  //Add the event location
  let eventLocationH4: HTMLElement = document.createElement("h4");
  let eventLocation: Text = document.createTextNode(eventData["eventLocation"]);
  eventLocationH4.appendChild(eventLocation);
  newEvent.appendChild(eventLocationH4);
  //Add the number of people attending the event
  let numberAttendingH4: HTMLElement = document.createElement("h4");
  let numberAttending: Text = document.createTextNode(
    `Number Attending: ${eventData["numberAttending"]}`,
  );
  numberAttendingH4.appendChild(numberAttending);
  newEvent.appendChild(numberAttendingH4);
  //Add the event description
  let eventDescriptionP: HTMLElement = document.createElement("p");
  let eventDescription: Text = document.createTextNode(
    eventData["eventDescription"],
  );
  eventDescriptionP.appendChild(eventDescription);
  newEvent.appendChild(eventDescriptionP);
  //Add the action button for the event, determined on user sign in
  let buttonRow: HTMLElement = document.createElement("section");
  buttonRow.setAttribute("class", "button-row left");
  let button: HTMLElement = document.createElement("a");
  button.setAttribute("class", "secondary");
  if (userRole === "admin") {
    //Add manage event button
    button.setAttribute("href", `./manage-event?id=${eventData["eventId"]}`);
    button.textContent = "Manage Event";
  } else {
    //Add sign up button
    button.setAttribute(
      "href",
      `./event-sign-up.html?id=${eventData["eventId"]}`,
    );
    button.textContent = "Sign Up";
  }
  buttonRow.appendChild(button);
  newEvent.appendChild(buttonRow);
  return newEvent;
}

async function loadEvents(userRole: string) {
  let eventsList: Event[] = [];
  try {
    //Get the events list from the firestoreService
    eventsList = await getAllEvents();
  } catch (error: any) {
    createMessage(error, "main-message", "error");
    return;
  }

  if (eventsList.length === 0) {
    //Create and display a no events card
    const noEventsCard = document.createElement("section");
    noEventsCard.setAttribute("id", "no-events-card");
    noEventsCard.setAttribute("class", "card");
    const noEventsP = document.createElement("p");
    const noEvents = document.createTextNode(
      "There are currently no upcoming events. Please check back later.",
    );
    noEventsP.appendChild(noEvents);
    noEventsCard.appendChild(noEventsP);
    const loadingCard = document.getElementById("loading");
    if (loadingCard) loadingCard.remove();
    main.appendChild(noEventsCard);
  } else {
    //Create the event elements
    const events = eventsList.reduce(
      (acc: HTMLElement, currentEvent: Event) => {
        const newEvent = addEventToPage(currentEvent, userRole);
        acc.appendChild(newEvent);
        return acc;
      },
      document.createElement("section"),
    );
    events.setAttribute("id", "events-list");
    const loadingCard = document.getElementById("loading");
    if (loadingCard) loadingCard.remove();
    main.appendChild(events);
  }
}

async function updateUIbasedOnAuth(userRole: string) {
  const eventsHeader = document.getElementById("events-header") as HTMLElement;
  //Check to see if the events list element is already in the DOM and remove it
  const eventsList = document.getElementById("events-list");
  if (eventsList) eventsList.remove();
  //If the user is an admin, add the create event button
  if (userRole === "admin") {
    //Add the Create New Event link and add it to the DOM if the user is an admin
    const createNewEventLink = document.createElement("a");
    createNewEventLink.setAttribute("href", "create-new-event.html");
    createNewEventLink.setAttribute("class", "secondary");
    const createEventIcon = document.createElement("span");
    createEventIcon.setAttribute("class", "material-symbols-outlined");
    const iconName = document.createTextNode("calendar_add_on");
    createEventIcon.appendChild(iconName);
    createNewEventLink.appendChild(createEventIcon);
    const createEventButtonText = document.createTextNode("Create New Event");
    createNewEventLink.appendChild(createEventButtonText);
    eventsHeader.appendChild(createNewEventLink);
  } else {
    //Check if the Create New Event link exists in the DOM and remove it
    const createEventLink = eventsHeader.querySelector("a");
    if (createEventLink) createEventLink.remove();
  }
}

initializeApp("Upcoming Events", "Upcoming Events").then(() => {
  auth.onAuthStateChanged(async (user) => {
    let userRole: string = "";
    if (user) {
      const fbUserRole = await getUserRole(user.uid);
      if (fbUserRole) {
        userRole = fbUserRole;
      } else {
        userRole = "signedInUser";
      }
    } else {
      userRole = "notSignedIn";
    }
    updateUIbasedOnAuth(userRole);
    loadEvents(userRole);
  });
});
