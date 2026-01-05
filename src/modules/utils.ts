import { Event, SignUpEntry, Component, InventoryEntry, Location, LocationItem } from "../models";
import { getListOfComponents } from "../firebaseService";
import { Timestamp } from "firebase/firestore";

type TableItem = SignUpEntry | Component | InventoryEntry | Location | LocationItem | {};

/**
 * Creates a button elment
 * @param buttonText - The text for the button
 * @param buttonType - The button type
 * @param buttonId - The ID for the button
 * @param buttonClass - Any classes for the button, used to apply css to the button
 * @param icon - Optional icon to add to the button
 * @returns
 */
export function createButton(
  buttonText: string,
  buttonType: string,
  buttonId: string,
  buttonClass: string,
  icon?: string,
): HTMLElement {
  const newButton = document.createElement("button");
  newButton.setAttribute("type", buttonType);
  newButton.setAttribute("id", buttonId);
  newButton.setAttribute("class", buttonClass);
  if (icon) {
    const buttonIconSpan = document.createElement("span");
    buttonIconSpan.setAttribute("class", "material-symbols-outlined");
    const buttonIcon = document.createTextNode(icon);
    buttonIconSpan.appendChild(buttonIcon);
    newButton.appendChild(buttonIconSpan);
  }
  const buttonTextElm = document.createTextNode(buttonText);
  newButton.appendChild(buttonTextElm);
  return newButton;
}

export function createLink(linkId: string | null, linkClass: string, linkText: string, linkHref: string, external: boolean, iconName: string | null) {
  const link = makeElement("a", linkId, linkClass, linkText);
  link.setAttribute('href', linkHref);
  if (external) {
    link.setAttribute('target', "_blank");
  }
  if (iconName) {
    const icon = makeElement("span", null, "material-symbols-outlined", iconName);
    icon.style.marginRight = "5px";
    link.prepend(icon);
  }
  return link;
}

/**
 * Create a table element and set the table head
 * @param tableId - The ID for the table
 * @param columnHeaders - The column headers
 * @returns - A table element
 */

export function createTable(tableId: string, columnHeaders: string[]) {
  //Create the table
  const newTable = document.createElement("table");
  //Set the table ID
  newTable.setAttribute("id", tableId);
  //Create the tbale head
  const tableHead = columnHeaders.reduce(
    (acc: HTMLElement, currentColumnHeader: string) => {
      const newColumnHeader = document.createElement("th");
      const columnHeaderName = document.createTextNode(currentColumnHeader);
      newColumnHeader.appendChild(columnHeaderName);
      acc.appendChild(newColumnHeader);
      return acc;
    },
    document.createElement("thead"),
  );
  newTable.appendChild(tableHead);
  return newTable;
}

export function makeElement(elementType: string, elementId: string | null, elementClass: string | null, elementText: string | null) {
  const newElement = document.createElement(elementType);
  if (elementId) newElement.setAttribute('id', elementId);
  if (elementClass) {
    newElement.setAttribute('class', elementClass);
  }
  if (elementText) newElement.textContent = elementText;
  return newElement;
}

export function createInput(inputType: string, name: string, labelText: string | null, dvivClass: string | null) {
  const newInput = makeElement("input", name, null, null);
  newInput.setAttribute("type", inputType);
  newInput.setAttribute("name", name);
  if (labelText) {
    const containerDiv = makeElement("div", null, dvivClass, null);
    const label = document.createElement('label');
    label.setAttribute("for", name);
    label.textContent = labelText;
    containerDiv.appendChild(label);
    containerDiv.appendChild(newInput);
    return containerDiv;
  } else {
    return newInput
  }
}

/**
 * Creates a table row element
 * @param item - The item to display
 * @param keysToDisplay - Determines which properties to show or hide. Used to hide the ID properties
 * @param primaryIdKeyName - The name of the primary key, used for creating a delete button
 * @param numCells - The number of cells in the table
 * @param dateFormat - Optional date format, used for fixDate()
 * @returns - The row element
 */
export function createTableRow(
  item: TableItem,
  keysToDisplay: string[],
  primaryIdKeyName: string,
  numCells: number,
  dateFormat?: string,
): HTMLElement {
  //Create a new table row
  let newRow: HTMLElement = document.createElement("tr");
  //Only add the keys in keysToDisplay, this excludes any Id keys
  for (const key of keysToDisplay) {
    const newCell = document.createElement("td");
    //Get the value for the key
    const itemValue = (item as any)[key];
    //Check if key is a date
    if (key.includes("Date")) {
      if (dateFormat && itemValue) {
        //Format the date and add the cell to the row
        const dateFixed: string = fixDate(itemValue, dateFormat);
        const dateString = document.createTextNode(dateFixed);
        newCell.appendChild(dateString);
      } else {
        //If dateFormat (shortDate or longDate) is not provided, just add the value to the cell
        const valueString = document.createTextNode(
          itemValue?.toString() || "",
        );
        newCell.appendChild(valueString);
      }
    } else if (key.includes("entry")) {
      const logEntry = item as InventoryEntry;
      let entryString: string = "";
      if (logEntry['locationName'] && logEntry['destination'] && !logEntry['external']) {
        //Items moved from one location to another internaly
        entryString = `${logEntry['quantity']} ${logEntry['componentType']} moved from ${logEntry['locationName']} to ${logEntry['destination']} by ${logEntry['whoDonated']}`;
      } else if (logEntry['locationName'] && !logEntry['external']) {
        //Items donated
        entryString = `${logEntry['quantity']} ${logEntry['componentType']} donated to ${logEntry['locationName']} by ${logEntry['whoDonated']}`;
      } else {
        //Items distributed externaly
        entryString = `${logEntry['quantity']} ${logEntry['componentType']} distributed from ${logEntry['locationName']} to ${logEntry['destination']} by ${logEntry['whoDonated']}`;
      }
      newCell.textContent = entryString;
    } else if (key === "quantity") {
      if (key in item) {
        const valueString = document.createTextNode(itemValue?.toString() || "");
        newCell.appendChild(valueString);
      } else {
        const valueString = document.createTextNode("0");
        newCell.appendChild(valueString);
      }

    } else {
      //Handle all other keys, add the value to the cell
      const valueString = document.createTextNode(itemValue?.toString() || "");
      newCell.appendChild(valueString);
    }
    //Add the cell to the row
    newRow.appendChild(newCell);
  }
  //If numCells is greater than the keys to display, add a delete button (Only admins are allow to delete entries and components)
  if (keysToDisplay.length !== numCells) {
    //Create a cell for the delete button
    const deleteButtonCell = document.createElement("td");
    //Get the itemId
    const itemId = (item as any)[primaryIdKeyName]?.toString() || "";
    //Create the delete button
    const deleteButton = createButton(
      "",
      "button",
      itemId,
      "delete-button-icon",
      "delete",
    );
    //Add the delete button to the cell
    deleteButtonCell.appendChild(deleteButton);
    //Add the cell to the row
    newRow.appendChild(deleteButtonCell);
  }
  //Return the new table row
  return newRow;
}

/**
 * Open a modal
 * @param modalBackdrop - The modal backdrop element
 * @param modal - The modal element
 * @param firstFocusElementId - The first element to trap keyboard focus on
 */
export function openModal(
  modalBackdrop: HTMLElement,
  modal: HTMLElement,
  firstFocusElementId: string,
) {
  //Prevent the page from scrolling
  const body = document.querySelector("body") as HTMLElement;
  body.classList.add("noScroll");
  //Display the modal by changing the display of the modal backdrop
  modalBackdrop.style.display = "flex";
  //Change the modal's aria attribute
  modal.setAttribute("aria-modal", "true");
  //Trap keyboard focus on the first input or button
  const firstFocusElement = document.getElementById(firstFocusElementId);
  if (firstFocusElement) {
    firstFocusElement.focus();
  }
  //Set up the keyboard trap for all focusable elements
  trapFocus(modal, modalBackdrop);
}

/**
 * Close a modal
 * @param modalBackdropId - The ID of the modal's backdrop
 */
export function closeModal(modalBackdropId: string) {
  const modalBackdrop = document.getElementById(modalBackdropId) as HTMLElement;
  const modal = modalBackdrop.getElementsByClassName("modal");
  //Change the modal's aria attribute
  if (modal) {
    modal[0].setAttribute("aria-modal", "false");
  }
  //Hide the modal by changing the display of the backdrop
  modalBackdrop.style.display = "none";
  //Remove the noScroll class to let the page scroll again
  const body = document.querySelector("body") as HTMLElement;
  body.classList.remove("noScroll");
}

/**
 * Creates and displays a message
 * @param message - The message to display
 * @param messageContainer - The location of the message
 * @param icon - The icon in the message. Used to determine the style of the message
 */
export function createMessage(message: string, location: string, type: string) {
  clearMessages();
  const messageWrapper = document.getElementById(location) as HTMLElement;
  const messageDiv = document.createElement("div");
  if (type === "check_circle") {
    messageDiv.setAttribute("class", "success message");
    messageDiv.setAttribute("aria-live", "polite");
  } else if (type === "error") {
    messageDiv.setAttribute("class", "error message");
    messageDiv.setAttribute("role", "alert");
    console.error(message);
  } else if (type === "delete" || type === "warn") {
    messageDiv.setAttribute("class", "warn message");
    messageDiv.setAttribute("aria-live", "polite");
    console.warn(message);
  } else {
    messageDiv.setAttribute("class", "info message");
    messageDiv.setAttribute("aria-live", "polite");
  }
  const icon = document.createElement("span");
  icon.setAttribute("class", "material-symbols-outlined");
  const iconName = document.createTextNode(type);
  icon.appendChild(iconName);
  messageDiv.appendChild(icon);
  const messageText = document.createTextNode(message);
  messageDiv.appendChild(messageText);
  const closeButton = createButton("", "button", "closeButton", "", "close");
  closeButton.addEventListener("click", () => (messageWrapper.innerHTML = ""));
  messageDiv.appendChild(closeButton);
  messageWrapper.appendChild(messageDiv);
}

/**
 * Used to clear any messages that are in the DOM
 */
export function clearMessages() {
  const messageWrappers = document.getElementsByClassName("message-wrapper");
  for (const messageWrapper of messageWrappers) {
    messageWrapper.innerHTML = "";
  }
}

/**
 * Stores a message in session storage to be displayed on next page load
 * @param message - The message to display
 * @param messageContainer - The location of the message
 * @param icon - The icon in the message. Used to determine the style of the message
 */
export function storeMessage(
  message: string,
  messageContainer: string,
  icon: string,
) {
  clearMessages();
  const messageToStore = {
    message: message,
    messageContainer: messageContainer,
    icon: icon,
  };
  sessionStorage.setItem("message", JSON.stringify(messageToStore));
}

/**
 * Checks if there is a message in session storage and calls createmessage() if there is a message waiting
 */
export function retrieveMessage() {
  const storedMessage = sessionStorage.getItem("message");
  if (storedMessage) {
    const messageToCreate: {
      message: string;
      messageContainer: string;
      icon: string;
    } = JSON.parse(storedMessage);
    createMessage(
      messageToCreate["message"],
      messageToCreate["messageContainer"],
      messageToCreate["icon"],
    );
    sessionStorage.removeItem("message");
  }
}

/**
 * Creates a modal to comnfirm deletion of an item
 * @param itemToDelete - The item to delete
 * @param modalTitle - The text for the h2 element in the modal
 * @returns - The delete modal
 */
export function createDeleteModal(
  itemToDelete: InventoryEntry | Component | SignUpEntry | Event | Location,
  modalTitle: string,
): HTMLElement | null {
  //Prevent the page from scrolling
  const body = document.querySelector("body") as HTMLElement;
  body.classList.add("noScroll");
  //Open delete item modal by changing the display of the backdrop
  const deleteItemBackdrop = document.getElementById(
    "delete-item-backdrop",
  ) as HTMLElement;
  const deleteForm = document.getElementById(
    "delete-item-modal",
  ) as HTMLFormElement;
  deleteItemBackdrop.style.display = "flex";
  deleteForm.setAttribute("aria-modal", "true");
  const deleteItemModal = document.getElementById(
    "delete-item-modal",
  ) as HTMLFormElement;
  deleteItemModal.innerHTML = "";
  //Display the modal title
  const deleteMoalH2 = document.createElement("h2");
  const deleteModalText = document.createTextNode(modalTitle);
  deleteMoalH2.appendChild(deleteModalText);
  deleteItemModal.appendChild(deleteMoalH2);
  //Create an array of the item's keys and values
  const itemKeys = Object.keys(itemToDelete);
  const itemValues = Object.values(itemToDelete);
  const l = itemValues.length;
  //Display the item's key value pairs
  for (let i = 0; i < l; i++) {
    const keyValueP = document.createElement("p");
    //Don't display the id key/values or event description
    if (
      !itemKeys[i].includes("Id") &&
      !itemKeys[i].includes("eventDescription")
    ) {
      const readableKey: string = itemKeys[i].replace(
        /([a-z])([A-Z])/g,
        "$1 $2",
      );
      let keyValue: Text;
      if (readableKey === "event Date" || readableKey === "entry date") {
        keyValue = document.createTextNode(
          `${readableKey.toLowerCase()}: ${fixDate(itemValues[i], "shortDate")} `,
        );
      } else {
        keyValue = document.createTextNode(
          `${readableKey.toLowerCase()}: ${itemValues[i]}`,
        );
      }

      keyValueP.appendChild(keyValue);
      deleteItemModal.appendChild(keyValueP);
    }
  }
  //Create button row
  const buttonRow = document.createElement("section");
  buttonRow.setAttribute("class", "button-row");
  const noButton = createButton("No", "button", "no", "secondary");
  buttonRow.appendChild(noButton);
  const yesButton = createButton("Yes", "button", "yes", "delete-button");
  buttonRow.appendChild(yesButton);
  deleteItemModal.appendChild(buttonRow);
  noButton.focus();
  trapFocus(deleteItemModal, deleteItemBackdrop);
  return buttonRow;
}

/**
 * Used to fix dates being displayed off by one day
 * @param dateString - The date as either a Firebase Timestamp or a string
 * @param dateFormat - shortDate: 12/25/2025 or longDate: December 25, 2025
 * @returns - The formatted date as a string
 */
export function fixDate(
  dateString: string | Timestamp,
  dateFormat: string,
): string {
  let dateObj: Date = new Date(0);
  //If Timestamp, convert it to a date object
  if (dateString instanceof Timestamp) {
    dateObj = dateString.toDate();
  }
  //If string, create a new date object
  else if (typeof dateString === "string") {
    dateObj = new Date(dateString);
  }
  //Check if the date object is valid
  if (isNaN(dateObj.getTime())) {
    console.error(
      "fixDate received an invalid date object after parsing:",
      dateString,
    );
    return "Invalid Date";
  }
  //Add timezone to fix date off by one error (with help from stackOverflow thread: https://stackoverflow.com/questions/7556591/is-the-javascript-date-object-always-one-day-off)
  let dateTimezoneFixed: Date = new Date(
    dateObj.getTime() - dateObj.getTimezoneOffset() * -60000,
  );
  //Define formatting options
  const options: Intl.DateTimeFormatOptions =
    dateFormat === "shortDate"
      ? { month: "2-digit", day: "2-digit", year: "numeric" }
      : { month: "long", day: "2-digit", year: "numeric" };
  return dateTimezoneFixed.toLocaleDateString("en-US", options);
}

/**
 * Creates options for every type of component in the inventory to add to the select inputs in forms
 * @param selctId - The ID of the select element to add the options to
 */
export async function populateComponteTypeSelect(selctId: string) {
  let selectElement = document.getElementById(selctId) as HTMLSelectElement;
  if (selectElement.options.length === 1) {
    let components: Component[] = [];
    try {
      components = await getListOfComponents();
      components.forEach((component) => {
        let newOption = document.createElement("option");
        newOption.setAttribute("value", component["componentType"]);
        let componentName = document.createTextNode(component["componentType"]);
        newOption.appendChild(componentName);
        selectElement.appendChild(newOption);
      });
    } catch (error) {
      throw error;
    }
  }
}

/**
 * Traps keyboard focus to the input elements and buttons in a modal
 * @param modal - The modal element
 * @param backdrop - The backdrop element for the modal
 */
export function trapFocus(modal: HTMLElement, backdrop: HTMLElement) {
  const focusableElements = modal.querySelectorAll(
    "button, [href], input, select, textarea",
  ) as NodeListOf<HTMLElement>;
  //Don't trap focus if the modal/backdrop isn't open
  if (backdrop.style.display === "none") {
    return;
  }
  //Warn if no focusable elements in modal
  if (!focusableElements.length) {
    console.warn(
      "trapFocus Function called on modal with no focusable elements",
    );
    return;
  }
  const firstFocusableElement: HTMLElement = focusableElements[0];
  const lastFocusableElement: HTMLElement =
    focusableElements[focusableElements.length - 1];
  document.addEventListener("keydown", (e) => {
    //Let user tab through only the elements in the modal
    if (e.key === "Tab") {
      if (e.shiftKey) {
        //If at first element, loop back to last element
        if (document.activeElement === firstFocusableElement) {
          lastFocusableElement.focus();
          e.preventDefault();
        }
      } else {
        //If at last element, loop to first element
        if (document.activeElement === lastFocusableElement) {
          firstFocusableElement.focus();
          e.preventDefault();
        }
      }
    }
  });
}

/**
 * Capitalizes the first letter of every word in the string
 * @param originalString - The original string
 * @returns - The string with the the first letter of every word capitalized
 */
export function capitalizeFirstLetter(originalString: string) {
  const wordsArray = originalString.split(" ");
  wordsArray.forEach((word, index) => {
    const firstLetter = word.charAt(0).toUpperCase();
    const restOfWord = word.slice(1);
    wordsArray[index] = firstLetter + restOfWord;
  });
  return wordsArray.join(" ");
}

export function createCheckbox(labelTextTrue: string, labelTextFalse: string, checkboxId: string, checked: boolean, full: boolean) {
  const checkBoxContainer = document.createElement("div");
  checkBoxContainer.setAttribute('class', "button-group-row");
  if (full) checkBoxContainer.classList.add("full");
  const checkboxLabel = document.createElement("label");
  checkboxLabel.setAttribute("for", checkboxId);
  if (checked) {
    checkboxLabel.textContent = labelTextTrue;
    checkboxLabel.setAttribute('class', 'secondary check');
  } else {
    checkboxLabel.textContent = labelTextFalse;
    checkboxLabel.setAttribute('class', 'secondary check');
  }

  if (full) checkboxLabel.classList.add("full");
  checkBoxContainer.appendChild(checkboxLabel);
  const checkboxInput = document.createElement('input') as HTMLInputElement;
  checkboxInput.setAttribute('type', 'checkbox');
  checkboxInput.setAttribute("id", checkboxId);
  checkboxInput.setAttribute("name", checkboxId);
  checkboxInput.checked = checked;
  checkboxInput.addEventListener('change', (e) => {
    const isChecked = (e.target as HTMLInputElement).checked;
    if (isChecked) {
      checkboxLabel.textContent = labelTextTrue;
      checkboxLabel.classList.remove('red');
      checkboxLabel.classList.add('green');
    } else {
      checkboxLabel.textContent = labelTextFalse;
      checkboxLabel.classList.remove('green');
      checkboxLabel.classList.add('red');
    }
  });
  checkBoxContainer.appendChild(checkboxInput);
  return checkBoxContainer;
}

export function createSelectList(items: Location[] | Component[], selectName: string, selctId: string, locationsToShow: string | null) {
  if (selectName === "component" && items.length === 0) {
    const selectElement = document.createElement('select');
    const chooseLocationOption = document.createElement('option');
    chooseLocationOption.textContent = "No items for this location";
    selectElement.appendChild(chooseLocationOption);
    return selectElement;
  }
  const selectElement = items.reduce((acc: HTMLElement, currentItem: Location | Component | LocationItem) => {
    const newOption = document.createElement("option");
    if (selectName === "component") {
      if ("componentType" in currentItem && "quantity" in currentItem) {
        newOption.textContent = currentItem['componentType'] + ": " + currentItem['quantity'];
        newOption.setAttribute('value', currentItem['componentId']);
        acc.appendChild(newOption);
      } else if ("componentType" in currentItem) {
        newOption.textContent = currentItem['componentType'];
        newOption.setAttribute('value', currentItem['componentId']);
        acc.appendChild(newOption);
      }
    } else if (selectName === "location" || selectName === "destination") {
      const location = currentItem as Location;
      newOption.textContent = location['locationName'];
        newOption.setAttribute("value", location['locationId']);
      if (locationsToShow === "internal") {
        if (location['external'] === false) {
          acc.appendChild(newOption);
        }
      } else if (locationsToShow === "external") {
        if (location['external'] === true) {
          acc.appendChild(newOption);
        }
      } else {
        acc.appendChild(newOption);
      }
    }
    return acc;
  }, document.createElement('select'));
  selectElement.setAttribute("name", selectName);
  selectElement.setAttribute('id', selctId);
  const choose = document.createElement('option');
  choose.textContent = `Select a ${selectName}`;
  choose.selected = true;
  selectElement.prepend(choose);
  return selectElement;
}