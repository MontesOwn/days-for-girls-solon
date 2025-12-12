import { initializeApp } from "./app.js";
import {
  createButton,
  createTableRow,
  createTable,
  createMessage,
  createDeleteModal,
  clearMessages,
  openModal,
  closeModal,
  fixDate,
} from "./utils.js";
import { InventoryEntry, ComponentItem, ComponentSummary } from "./models.js";
import {
  addComponent,
  getAllComponents,
  deleteComponent,
  seedIfEmptyInventoryLog,
  getAllLogEntires,
} from "./firebaseService.js";
import { auth } from "./firebase.js";
import { User } from "./authService.js";
import { getUserRole } from "./authService.js";

//DOM elements
const generateForm = document.getElementById("generateForm") as HTMLFormElement;
const mainContent = document.getElementById("maincontent") as HTMLElement;
const currentInventoryCard = document.getElementById(
  "current-inventory-card",
) as HTMLElement;
const manageInventoryCard = document.getElementById(
  "manage-inventory-card",
) as HTMLElement;
const manageInventoryBackdrop = document.getElementById(
  "manage-inventory-backdrop",
) as HTMLElement;
const manageInventoryModal = document.getElementById(
  "manage-inventory-modal",
) as HTMLElement;

function addNewRow(newComponent: ComponentItem, userRole: string | null) {
  //Create a new row for the table with the component details
  const keysToDisplay = ["componentType", "quantity"];
  const idKeyName = "componentId";
  //Only admins are allowed to delete components
  if (userRole === "admin") {
    const newRow = createTableRow(
      newComponent,
      keysToDisplay,
      idKeyName,
      3,
      "componentItem",
    );
    //Add an event listener to the components delete button
    const deleteButton = newRow.querySelector("button");
    if (deleteButton) {
      deleteButton.addEventListener("click", () => {
        //Create/open the modal and get the button row to add event lsiteners
        const buttonRow = createDeleteModal(
          newComponent,
          `Are you sure you want to delete this component?`,
        );
        if (buttonRow) {
          const noButton = buttonRow.children[0];
          const yesButton = buttonRow.children[1];
          if (yesButton) {
            yesButton.addEventListener("click", async () => {
              //Close the delete modal
              closeModal("delete-item-backdrop");
              try {
                //Delete the component
                await deleteComponent(newComponent["componentId"]);
                //Create a message saying the component has been deleted
                createMessage(
                  `Deleted component "${newComponent["componentType"]}"`,
                  "main-message",
                  "delete",
                );
                //Remove the component from the table
                newRow.remove();
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
  } else {
    //If the user is not an admin, don't add the delete button to the table row
    return createTableRow(
      newComponent,
      keysToDisplay,
      idKeyName,
      2,
      "componentItem",
    );
  }
}

async function loadCurrentInventory(userRole: string | null) {
  let currrentInventoryArray: ComponentItem[] = [];
  try {
    //Get the current inventory from the firestore
    currrentInventoryArray = await getAllComponents();
  } catch (error: any) {
    createMessage(error, "main-message", "error");
    return;
  }
  if (currrentInventoryArray.length === 0) {
    //Display no inventory message
    const noInventoryP = document.createElement("p");
    const noInventory = document.createTextNode(
      "There are not items currently in the inventory.",
    );
    noInventoryP.appendChild(noInventory);
    currentInventoryCard.appendChild(noInventoryP);
  } else {
    //Create the current inventory table
    let tableColumnHeaders: string[] = [];
    //Only admins can delete components
    if (userRole === "admin") {
      tableColumnHeaders = ["Component", "Quantity", "Delete"];
    } else {
      tableColumnHeaders = ["Component", "Quantity"];
    }
    //If the current inventory table already exists in the DOM, remove it
    const previousTableContainer = document.getElementById(
      "inventory-table-container",
    );
    if (previousTableContainer) previousTableContainer.remove();
    const tableContainer = document.createElement("div");
    tableContainer.setAttribute("id", "inventory-table-container");
    tableContainer.setAttribute("class", "table-container");
    const currentInventoryTable = createTable(
      "current-inventory-table",
      tableColumnHeaders,
    );
    const tableBody = currrentInventoryArray.reduce(
      (acc: HTMLElement, currentComponent: ComponentItem) => {
        const newRow = addNewRow(currentComponent, userRole);
        acc.appendChild(newRow);
        return acc;
      },
      document.createElement("tbody"),
    );
    tableBody.setAttribute("id", "currentInventoryTableBody");
    currentInventoryTable.appendChild(tableBody);
    tableContainer.appendChild(currentInventoryTable);
    currentInventoryCard.appendChild(tableContainer);
  }
  //Hide the loading card and display the current inventory card
  const loadingCard = document.getElementById("loading");
  if (loadingCard) loadingCard.remove();
  currentInventoryCard.classList.remove("hide");
}

async function filterDateRange(startDate: Date, endDate: Date) {
  let logEntries: InventoryEntry[] = [];
  try {
    logEntries = await getAllLogEntires();
  } catch (error) {
    createMessage(
      "Error generating report. Please try reloading the page",
      "main-message",
      "error",
    );
    return;
  }
  //Filter allEntries array for entries within date range
  let filteredEntries: InventoryEntry[] = logEntries.filter((item) => {
    return (
      item["entryDate"].toDate() >= startDate &&
      item["entryDate"].toDate() <= endDate
    );
  });
  //Sort filteredEntries array by date
  let filteredEntriesSorted = filteredEntries.sort((a, b) => {
    return (
      a["entryDate"].toDate().getTime() - b["entryDate"].toDate().getTime()
    );
  });
  return filteredEntriesSorted;
}

//Takes an array of inventory log entries and summarizes the array
async function calculateInventoryTotals(filteredArray: InventoryEntry[]) {
  let currrentInventoryArray: ComponentItem[] = [];
  try {
    currrentInventoryArray = await getAllComponents();
  } catch (error: any) {
    createMessage(error, "main-message", "error");
    return;
  }
  const uniqueComponents: ComponentSummary[] = currrentInventoryArray.reduce(
    (acc: ComponentSummary[], currentComponent: ComponentItem) => {
      const newComponent: ComponentSummary = {
        componentType: currentComponent["componentType"],
        quantityDonated: 0,
        quantityDistributed: 0,
      };
      const currentComponentEntries = filteredArray.filter(
        (item) => item["componentType"] === newComponent["componentType"],
      );
      currentComponentEntries.forEach((entry) => {
        if (entry["whoDonated"]) {
          newComponent["quantityDonated"] += entry["quantity"];
        } else {
          newComponent["quantityDistributed"] += entry["quantity"];
        }
      });
      acc.push(newComponent);
      return acc;
    },
    [],
  );
  return uniqueComponents;
}

function createSummaryTable(entriesSummary: ComponentSummary[]) {
  //Table container
  const tableContainer = document.createElement("div");
  tableContainer.setAttribute("id", "summary-table-container");
  tableContainer.setAttribute("class", "table-container");
  //Create the table
  const summaryTable = createTable("summary-table", [
    "Total Donated",
    "Total Distributed",
  ]);
  //table body
  const summaryBody = entriesSummary.reduce(
    (acc: HTMLElement, currentItem: ComponentSummary) => {
      let newRow = document.createElement("tr");
      let donatedCell = document.createElement("td");
      let donated = document.createTextNode(
        `${currentItem["componentType"]}: ${currentItem["quantityDonated"]}`,
      );
      donatedCell.appendChild(donated);
      newRow.appendChild(donatedCell);
      let distributedCell = document.createElement("td");
      let distributed = document.createTextNode(
        `${currentItem["componentType"]}: ${currentItem["quantityDistributed"]}`,
      );
      distributedCell.appendChild(distributed);
      newRow.appendChild(distributedCell);
      acc.appendChild(newRow);
      return acc;
    },
    document.createElement("tbody"),
  );
  summaryTable.appendChild(summaryBody);
  tableContainer.appendChild(summaryTable);
  return tableContainer;
}

function createEntriesTable(filteredResults: InventoryEntry[]) {
  //Table container
  const tableContainer = document.createElement("div");
  tableContainer.setAttribute("id", "entries-table-container");
  tableContainer.setAttribute("class", "table-container");
  //Create the table
  const entriesTable = createTable("entries-table", ["Date", "Entry"]);
  //table body
  const entiresBody = filteredResults.reduce(
    (acc: HTMLElement, currentEntry: InventoryEntry) => {
      const entryRow = document.createElement("tr");
      const dateCell = document.createElement("td");
      const date = document.createTextNode(
        fixDate(currentEntry["entryDate"], "shortDate"),
      );
      dateCell.appendChild(date);
      entryRow.appendChild(dateCell);
      const entryCell = document.createElement("td");
      if (currentEntry["whoDonated"]) {
        const entryText = document.createTextNode(
          `${currentEntry["quantity"]} ${currentEntry["componentType"]} donated by ${currentEntry["whoDonated"]}`,
        );
        entryCell.appendChild(entryText);
      } else {
        const entryText = document.createTextNode(
          `${currentEntry["quantity"]} ${currentEntry["componentType"]} distributed to ${currentEntry["destination"]}`,
        );
        entryCell.appendChild(entryText);
      }
      entryRow.appendChild(entryCell);
      acc.appendChild(entryRow);
      return acc;
    },
    document.createElement("tbody"),
  );
  entriesTable.appendChild(entiresBody);
  tableContainer.appendChild(entriesTable);
  return tableContainer;
}

async function generateReport() {
  //Create a generating report message
  createMessage("Generating inventory report...", "report-message", "info");
  let formData: FormData = new FormData(generateForm);
  let startDateValue = formData.get("startDate");
  let endDateValue = formData.get("endDate");
  //Validate date range
  if (startDateValue && endDateValue) {
    if (
      new Date(startDateValue.toString()) > new Date(endDateValue.toString())
    ) {
      //Checking that the end date is a later date than the start date
      createMessage(
        "Please make sure the end date is a later date than the start date",
        "report-message",
        "error",
      );
      return;
    }
  } else if (!startDateValue && !endDateValue) {
    //Checking if both date inputs are not filled in
    createMessage(
      "Please select start and end dates",
      "report-message",
      "error",
    );
    return;
  } else if (!startDateValue && endDateValue) {
    //Checking if only the start date is not filled in
    createMessage("Please select a start date", "report-message", "error");
    return;
  } else if (startDateValue && !endDateValue) {
    //Checking if only the end date is not filled in
    createMessage("Please select an end date", "report-message", "error");
    return;
  }
  //Hide the form
  generateForm.style.display = "none";
  //Create the report card element
  if (startDateValue && endDateValue) {
    let startDate = new Date(startDateValue.toString());
    let endDate = new Date(endDateValue.toString());
    let reportCard = document.createElement("article");
    reportCard.setAttribute("class", "card");
    //Create list of entries within date range
    let filteredResults = await filterDateRange(startDate, endDate);
    if (filteredResults) {
      if (filteredResults.length === 0) {
        //No results
        let noResultsH2 = document.createElement("h2");
        let noResults = document.createTextNode("No results");
        noResultsH2.appendChild(noResults);
        reportCard.appendChild(noResultsH2);
        let noResultsP = document.createElement("p");
        let noresultsText = document.createTextNode(
          `No items where donated or distributed ${fixDate(startDateValue.toString(), "shortDate")} to ${fixDate(endDateValue.toString(), "shortDate")}`,
        );
        noResultsP.appendChild(noresultsText);
        reportCard.appendChild(noResultsP);
      } else {
        let reportH2 = document.createElement("h2");
        let reportTitle = document.createTextNode(
          `${fixDate(startDateValue.toString(), "shortDate")} to ${fixDate(endDateValue.toString(), "shortDate")} Report`,
        );
        reportH2.appendChild(reportTitle);
        reportCard.appendChild(reportH2);
        //Generate donated and distributed totals within date range
        let entriesSummary = await calculateInventoryTotals(filteredResults);
        if (entriesSummary) {
          //create table to summarize all entries
          const summaryTable = createSummaryTable(entriesSummary);
          reportCard.appendChild(summaryTable);
          //Generate table for all entries in date range
          const entriesTable = createEntriesTable(filteredResults);
          reportCard.appendChild(entriesTable);
        } else {
          return;
        }
      }
      //Create button to generate new inventory report
      const formRow = document.createElement("div");
      formRow.setAttribute("class", "form-row");
      const newReportButton = createButton(
        "Generate New Report",
        "button",
        "newReport",
        "primary fulll",
      );
      newReportButton.addEventListener("click", () => {
        reportCard.remove();
        generateForm.style.display = "block";
      });
      formRow.appendChild(newReportButton);
      reportCard.appendChild(formRow);
      clearMessages();
      mainContent.appendChild(reportCard);
      reportCard.scrollIntoView({ behavior: "smooth" });
    }
  } else {
    return;
  }
}

async function submitData(formData: FormData) {
  const newComponent: ComponentItem = {
    componentId: "",
    componentType: "",
    quantity: 0,
  };
  const newComponentName = formData.get("nameInput");
  if (newComponentName === null || newComponentName.toString().trim() === "") {
    createMessage(
      "Please enter the name of the new component type",
      "manage-inventory-message",
      "error",
    );
    return;
  } else {
    newComponent["componentType"] = newComponentName.toString().trim();
    try {
      const componentId = await addComponent(newComponent);
      closeModal("manage-inventory-backdrop");
      if (componentId) {
        newComponent["componentId"] = componentId;
        //The component was added successfully to the firestore
        createMessage(
          `Added '${newComponent["componentType"]}' to inventory`,
          "main-message",
          "check_circle",
        );
        newComponent["componentId"] = componentId;
        //Get the current Inventory table body
        const currentInventoryTableBody = document.getElementById(
          "currentInventoryTableBody",
        );
        if (currentInventoryTableBody) {
          //If the table body exists, add the new row to the top of the table
          //We know the user is an admin, so just pass it as a string instead of from userRole = await getUserRole(user.uid);
          const newRow = addNewRow(newComponent, "admin");
          currentInventoryTableBody.appendChild(newRow);
        } else {
          //If the table body does not exist, create/load the table
          loadCurrentInventory("admin");
        }
      } else {
        //The component was not added to the firestore
        createMessage(
          "Failed to add new component. Please try again.",
          "main-message",
          "error",
        );
      }
    } catch (error: any) {
      createMessage(error, "main-message", "error");
    }
  }
}

async function updateUIbasedOnAuth(user: User | null) {
  let userRole: string | null = null;
  if (user) {
    userRole = await getUserRole(user.uid);
    //If the user is an admin, show the links to the inventory entry logs, the manage inventory card, and the generate report card
    if (userRole === "admin") {
      if (generateForm.classList.contains("hide"))
        generateForm.classList.remove("hide");
      const inventoryLogLinks = document.getElementById(
        "inventory-log-links",
      ) as HTMLElement;
      if (inventoryLogLinks.classList.contains("hide"))
        inventoryLogLinks.classList.remove("hide");
      if (manageInventoryCard.classList.contains("hide"))
        manageInventoryCard.classList.remove("hide");
    }
  } else {
    //User is not signed in, hide the manage inventory card and generate report form
    if (!manageInventoryCard.classList.contains("hide"))
      manageInventoryCard.classList.add("hide");
    if (!generateForm.classList.contains("hide"))
      generateForm.classList.add("hide");
  }
  loadCurrentInventory(userRole);
  //If user is an admin, allow the creation of new compoents
  if (userRole === "admin") {
    //Event listener to generate inventory report
    generateForm.addEventListener("submit", (e) => {
      e.preventDefault();
      generateReport();
    });

    //Event listener for button to open Manage Inventory Modal
    const openMangeInventoryButton = document.getElementById(
      "add-new-type",
    ) as HTMLElement;
    openMangeInventoryButton.addEventListener("click", () => {
      manageInventoryModal.innerHTML = "";
      //Create the form to add a new component type
      const addNewComponentTypeForm = document.createElement("form");
      const formHeaderH2 = document.createElement("h2");
      const formHeader = document.createTextNode("Add a New Component Type");
      formHeaderH2.appendChild(formHeader);
      addNewComponentTypeForm.appendChild(formHeaderH2);
      const nameInputRow = document.createElement("section");
      nameInputRow.setAttribute("class", "form-row");
      const nameLabel = document.createElement("label");
      nameLabel.setAttribute("for", "nameInput");
      const nameText = document.createTextNode("Name of new component type:");
      nameLabel.appendChild(nameText);
      nameInputRow.appendChild(nameLabel);
      const nameInput = document.createElement("input");
      nameInput.setAttribute("type", "text");
      nameInput.setAttribute("id", "nameInput");
      nameInput.setAttribute("name", "nameInput");
      nameInputRow.appendChild(nameInput);
      addNewComponentTypeForm.appendChild(nameInputRow);
      const buttonRow = document.createElement("section");
      buttonRow.setAttribute("class", "button-row");
      const cancelButton = createButton(
        "Cancel",
        "button",
        "cancelButton",
        "secondary",
      );
      cancelButton.addEventListener("click", () => {
        //Close the modal
        closeModal("manage-inventory-backdrop");
      });
      buttonRow.appendChild(cancelButton);
      const submitButton = createButton(
        "Submit",
        "submt",
        "submitButton",
        "primary",
      );
      buttonRow.appendChild(submitButton);
      addNewComponentTypeForm.appendChild(buttonRow);
      addNewComponentTypeForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const data = new FormData(addNewComponentTypeForm);
        submitData(data);
      });
      //Add the form to the modal
      manageInventoryModal.appendChild(addNewComponentTypeForm);
      //Open the modal
      openModal(manageInventoryBackdrop, manageInventoryModal, "nameInput");
    });
  }
}

initializeApp("Inventory", "Inventory").then(async () => {
  //Check to see in inventory log is empty. donated and distributed inventory pages will throw errors if the log is empty
  await seedIfEmptyInventoryLog();
  auth.onAuthStateChanged(async (user) => {
    await updateUIbasedOnAuth(user);
  });
});
