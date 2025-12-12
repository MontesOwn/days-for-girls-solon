import { createMessage, storeMessage, fixDate, capitalizeFirstLetter } from "./utils.js";
import { getEventById, addSignUpEntry } from "./firebaseService.js";
import { initializeApp } from "./app.js";
import { SignUpEntry, Event } from "./models.js";
import { auth } from "./firebase.js";

//DOM Elements
const signUpForm = document.getElementById("sign-up-form") as HTMLFormElement;

//Get event id from url
const urlParams = new URLSearchParams(window.location.search);
const idString: string | null = urlParams.get("id");
const eventId: string = idString ? idString : "";
//Create a null event element, to be loaded inside initAppLogic
let eventObject: Event | null = null;

async function initAppLogic() {
  //Check for event ID
  if (eventId === "") {
    //If the id is not in the url, store a message and redirect to the events page
    storeMessage(
      "Error loading event. Please try again.",
      "main-message",
      "error",
    );
    window.location.href = "events.html";
    return;
  }

  //Try to get the event once the app initialization is complete
  try {
    eventObject = await getEventById(eventId);
  } catch (error: any) {
    //If there is an error loading the event, store a message and redirect to the events page
    storeMessage(error, "main-message", "error");
    window.location.href = "events.html";
    return;
  }

  if (eventObject === null) {
    //If the eventObject is null, create a no event card
    createMessage("Could not find event", "main-message", "error");
    signUpForm.remove();
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
    //Set the event info
    const signUpHeader = document.getElementById(
      "sign-up-header",
    ) as HTMLElement;
    const signUpTitleH2 = document.createElement("h2");
    const signUpTitle = document.createTextNode(
      `Sign up for ${eventObject["eventTitle"]}`,
    );
    signUpTitleH2.appendChild(signUpTitle);
    signUpHeader.appendChild(signUpTitleH2);
    const dateTimeH3 = document.createElement("h3");
    const dateTime = document.createTextNode(
      `${fixDate(eventObject["eventDate"], "longDate")} ${eventObject["eventTime"]}`,
    );
    dateTimeH3.appendChild(dateTime);
    signUpHeader.appendChild(dateTimeH3);
    const eventLocationH3 = document.createElement("h3");
    const eventLocation = document.createTextNode(eventObject["eventLocation"]);
    eventLocationH3.appendChild(eventLocation);
    signUpHeader.appendChild(eventLocationH3);
    //Remove the loading card
    const loadingCard = document.getElementById("loading");
    if (loadingCard) loadingCard.remove();
    //Populate inputs with user info if signed in
    auth.onAuthStateChanged((user) => {
      if (user) {
        const fullNameInput = document.getElementById(
          "fullName",
        ) as HTMLFormElement;
        fullNameInput.value = user.displayName;
        const emailInput = document.getElementById("email") as HTMLFormElement;
        emailInput.value = user.email;
      }
    });
    //show the event card
    signUpForm.classList.remove("hide");
  }

  async function submitData() {
    //Create a submitting data message while the app validates and submits the data
    createMessage("Submitting entry data...", "main-message", "info");
    //Get the form data
    const signUpFormData: FormData = new FormData(signUpForm);
    //Create an object for the entry
    let newSignUp: SignUpEntry = {
      entryId: "",
      eventId: eventId,
      fullName: "",
      email: "",
    };
    //Validate full name input
    const fullNameValue = signUpFormData.get("fullName");
    if (fullNameValue === null || fullNameValue.toString().trim() === "") {
      createMessage("Please enter your name", "main-message", "error");
      return;
    } else {
      let firstLastCheck = fullNameValue.toString().split(" ");
      if (firstLastCheck.length < 2) {
        createMessage(
          "Please enter your first and last name",
          "main-message",
          "error",
        );
        return;
      } else {
        newSignUp["fullName"] = capitalizeFirstLetter(fullNameValue.toString());
      }
    }
    //Validate email
    const emailValue = signUpFormData.get("email");
    if (emailValue === null || emailValue.toString().trim() === "") {
      createMessage("Please enter your email", "main-message", "error");
      return;
    }
    const checkForAtSymbol = emailValue.toString().split("@");
    if (checkForAtSymbol.length < 2) {
      createMessage("Please enter a valid email", "main-message", "error");
      return;
    } else {
      newSignUp["email"] = emailValue.toString();
    }
    //Get any comments entered
    const commentsValue = signUpFormData.get("comments");
    if (commentsValue) {
      newSignUp["comments"] = commentsValue.toString();
    }
    //Add the sign up entry to the firestore
    try {
      await addSignUpEntry(newSignUp);
      /* Create a message saying sign up entry was successfully created and store it.
            It will be displayed on events page */
      storeMessage(
        `You have sucessfully signed up for the event '${eventObject!["eventTitle"]}'`,
        "main-message",
        "check_circle",
      );
      // Redirect to the events page
      window.location.href = "events.html";
    } catch (error: any) {
      createMessage(error, "main-message", "error");
    }
  }

  signUpForm.addEventListener("submit", (e) => {
    e.preventDefault();
    submitData();
  });
}

initializeApp("Upcoming Events", "Event Sign Up").then(() => {
  //Load the event detail after the app initialization has finished
  initAppLogic();
});
