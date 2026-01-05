import { initializeApp } from "./app";
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
  makeElement,
  createLink,
  createInput,
  createCheckbox
} from "./modules/utils";
import { InventoryEntry, Component, ComponentSummary, Location, LocationItem } from "./models";
import {
  addNewComponent,
  getListOfComponents,
  deleteComponent,
  getAllLogEntires,
  getListOfLocations,
  addNewLocation,
  deleteLocation,
  getAllLocationItems,
} from "./firebaseService";
import { auth } from "./firebase";
import { User } from "./authService";
import { getUserRole } from "./authService";
import { navigateTo } from "./modules/navigate";

//DOM elements
const mainContent = document.getElementById("maincontent") as HTMLElement;
const manageInventoryBackdrop = document.getElementById("manage-inventory-backdrop") as HTMLElement;
let manageInventoryModal = document.getElementById("manage-inventory-modal") as HTMLElement;

initializeApp("Inventory", "Inventory").then(async () => {
  auth.onAuthStateChanged(async (user) => {
    await updateUIbasedOnAuth(user);
  });
});

async function updateUIbasedOnAuth(user: User | null) {
  let userRole: string | null = null;
  const oldInventoryCard = document.getElementById('current-inventory-card');
  if (oldInventoryCard) oldInventoryCard.remove();
  const currentInventoryCard = makeElement("article", "current-inventory-card", "card", null);
  const loadingDiv = makeElement("div", "loading", "button-row left", null);
  const loader = makeElement("div", "loader", "loader", null);
  loadingDiv.appendChild(loader);
  const loadingText = makeElement("h2", "loading", null, "Loading Inventory");
  loadingDiv.appendChild(loadingText);
  currentInventoryCard.appendChild(loadingDiv);
  mainContent.appendChild(currentInventoryCard);
  if (user) {
    userRole = await getUserRole(user.uid);
    if (userRole === "admin") {
      //Create an empty card for managing storage locations
      const manageLocationsCard = makeElement("article", "manage-storage-locations-card", "card hide", null);
      mainContent.appendChild(manageLocationsCard);
      //Create the Manage Inventory card
      const manageInventoryCard = makeElement("article", "manage-inventory-card", "card", null);
      const cardHeading = makeElement("h2", null, null, "Manage Inventory");
      manageInventoryCard.appendChild(cardHeading);
      const buttonRow = makeElement("section", null, "button-row", null);
      const inventoryLogButton = createButton("Add / Move / Distribute Items", "button", "inventory-log-button", "secondary");
      inventoryLogButton.addEventListener('click', () => navigateTo("/inventoryLog"));
      buttonRow.appendChild(inventoryLogButton);
      const addNewComponentButton = createButton("Manage component types", "button", "add-new-type", "secondary", "add");
      addNewComponentButton.addEventListener('click', () => {
        loadAddNewComponentModal();
      });
      buttonRow.appendChild(addNewComponentButton);
      const manageStorageLocations = createButton("Manage Storage Locations", "buttton", "manage-locations-button", "secondary", "location_on");
      manageStorageLocations.addEventListener('click', () => {
        loadManageLocationsCard();
      });
      buttonRow.appendChild(manageStorageLocations);
      manageInventoryCard.appendChild(buttonRow);
      mainContent.appendChild(manageInventoryCard);
      //Create the Generate Report card
      const reportMessageWrapper = makeElement("section", "report-message", "message-wrapper", null);
      mainContent.appendChild(reportMessageWrapper);
      const generateReportCard = makeElement("form", "generate-form", "card", null) as HTMLFormElement;
      const formHeading = makeElement("h2", null, null, "Generate Report");
      generateReportCard.appendChild(formHeading);
      const formRow = makeElement("section", null, "button-row", null);
      const startDateInput = createInput("date", "start-date-input", "Start Date:", null);
      formRow.appendChild(startDateInput);
      const endDateInput = createInput("date", "end-date-input", "End Date:", null);
      formRow.appendChild(endDateInput);
      generateReportCard.appendChild(formRow);
      const formButtonRow = makeElement("section", null, "form-row", null);
      const submitButton = createButton("submit", "submit", "generate-button", "primary full", "list_alt_add");
      formButtonRow.appendChild(submitButton);
      generateReportCard.appendChild(formButtonRow)
      generateReportCard.addEventListener('submit', (e) => {
        e.preventDefault();
        generateReport(generateReportCard);
      });
      mainContent.appendChild(generateReportCard);
    }

  }
  await loadCurrentInventory(currentInventoryCard, userRole);
  loadingDiv.remove();
}

function addNewRow(newComponent: LocationItem | Component, showDeleteButton: boolean) {
  //Create a new row for the table with the component details
  const keysToDisplay = ["componentType", "quantity"];
  const idKeyName = "componentId";
  //Only admins are allowed to delete components
  if (showDeleteButton) {
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

async function loadCurrentInventory(currentInventoryCard: HTMLElement, userRole: string | null) {
  let currrentInventoryArray: LocationItem[] = [];
  let locations: Location[] = [];
  let showDeleteButton: boolean = false;
  if (userRole === "admin") showDeleteButton = true;
  try {
    //Get the current inventory from the firestore
    currrentInventoryArray = await getAllLocationItems();
    locations = await getListOfLocations();
  } catch (error: any) {
    createMessage(error, "main-message", "error");
    return;
  }
  const cardHeading = makeElement("h2", "card-heading", null, "Current Inventory");
  currentInventoryCard.appendChild(cardHeading);

  if (currrentInventoryArray.length === 0) {
    const componentItems: Component[] = await getListOfComponents();
    if (componentItems.length === 0) {
      //Display no inventory message
      const noInventoryP = document.createElement("p");
      const noInventory = document.createTextNode(
        "There are not items currently in the inventory.",
      );
      noInventoryP.appendChild(noInventory);
      currentInventoryCard.appendChild(noInventoryP);
    } else {
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
      const tableBody = componentItems.reduce(
        (acc: HTMLElement, currentComponent: Component) => {
          const newRow = addNewRow(currentComponent, showDeleteButton);
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
  } else {
    //Add filter button row
    const filterRow = makeElement("section", "filter-row", "button-row", null);
    const allInventoryButton = createButton("All Inventory", "button", "all-inventory-button", "secondary");
    allInventoryButton.addEventListener('click', () => {
      const oldHeading = document.getElementById("card-heading") as HTMLElement;
      const newHeading = makeElement("h2", "card-heading", null, "Current Inventory");
      currentInventoryCard.replaceChild(newHeading, oldHeading);
      const inventoryArray: LocationItem[] = filterInventoryForLocation("all", currrentInventoryArray);
      createInvetoryTable(inventoryArray, userRole);
    });
    filterRow.appendChild(allInventoryButton);
    locations.forEach(location => {
      if (!location['external']) {
        const filterForLocationButton = createButton(`${location['locationName']}`, "button", `${location['locationName']}-filter`, "secondary");
        filterForLocationButton.addEventListener('click', () => {
          const oldHeading = document.getElementById("card-heading") as HTMLElement;
          const newHeading = makeElement("h2", "card-heading", null, `Current Inventory at ${location['locationName']}`);
          currentInventoryCard.replaceChild(newHeading, oldHeading);
          const inventoryArray: LocationItem[] = filterInventoryForLocation(location['locationId'], currrentInventoryArray);
          createInvetoryTable(inventoryArray, userRole);
        });
        filterRow.appendChild(filterForLocationButton);
      }
    });
    currentInventoryCard.appendChild(filterRow);
    //Filter items
    const inventoryArray: LocationItem[] = filterInventoryForLocation("all", currrentInventoryArray);
    createInvetoryTable(inventoryArray, null);
    //Hide the loading card and display the current inventory card
    const loadingCard = document.getElementById("loading");
    if (loadingCard) loadingCard.remove();
  }

  function filterInventoryForLocation(locationId: string, currrentInventoryArray: LocationItem[]) {
    if (locationId === "all") {
      return Object.values(
        currrentInventoryArray.reduce((acc, item) => {
          const { componentId, quantity } = item;
          if (!acc[componentId]) {
            acc[componentId] = {
              locationId: "all",
              locationName: "all",
              componentId: item['componentId'],
              componentType: item['componentType'],
              quantity: item['quantity']
            };
          } else {
            // Add to the existing quantity
            acc[componentId].quantity += quantity;
          }

          return acc;
        }, {} as Record<string, LocationItem>)
      );
    } else {
      const filteredArray = currrentInventoryArray.filter(item => item['locationId'] === locationId);
      if (filteredArray.length > 0) {
        return filteredArray
      }
      return [];
    }
  }

  function createInvetoryTable(inventoryArray: LocationItem[], userRole: string | null) {
    console.log(`The inventory array has a length of ${inventoryArray.length}`);
    const prevNoInventory = document.getElementById("no-inventory");
    if (prevNoInventory) prevNoInventory.remove();
    //Create the current inventory table
    let tableColumnHeaders: string[] = [];
    // let showDeleteButton: boolean = false;
    // if (userRole === "admin" && inventoryArray.length > 0 && inventoryArray[0]['locationId'] === "all") {
    //   showDeleteButton = true;
    // }
    // //Only admins can delete components
    // if (showDeleteButton) {
    //   tableColumnHeaders = ["Component", "Quantity", "Delete"];
    // } else {
    //   tableColumnHeaders = ["Component", "Quantity"];
    // }
    tableColumnHeaders = ["Component", "Quantity"];
    //If the current inventory table already exists in the DOM, remove it
    const previousTableContainer = document.getElementById(
      "inventory-table-container",
    );
    if (previousTableContainer) previousTableContainer.remove();
    if (inventoryArray.length === 0) {
      const noInventory = makeElement("p", "no-inventory", null, "No inventory for this location");
      currentInventoryCard.appendChild(noInventory);
    } else {
      const tableContainer = document.createElement("div");
    tableContainer.setAttribute("id", "inventory-table-container");
    tableContainer.setAttribute("class", "table-container");
    const currentInventoryTable = createTable(
      "current-inventory-table",
      tableColumnHeaders,
    );
    const tableBody = inventoryArray.reduce(
      (acc: HTMLElement, currentComponent: LocationItem) => {
        const newRow = addNewRow(currentComponent, false);
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
    
  }
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
  let currrentInventoryArray: Component[] = [];
  try {
    currrentInventoryArray = await getListOfComponents();
  } catch (error: any) {
    createMessage(error, "main-message", "error");
    return;
  }
  const uniqueComponents: ComponentSummary[] = currrentInventoryArray.reduce(
    (acc: ComponentSummary[], currentComponent: Component) => {
      const newComponent: ComponentSummary = {
        componentId: currentComponent['componentId'],
        componentType: currentComponent["componentType"],
        quantityDonated: 0,
        quantityDistributed: 0,
      };
      const currentComponentEntries = filteredArray.filter(
        (item) => item['componentId'] === newComponent["componentId"],
      );
      currentComponentEntries.forEach((entry) => {
        if (entry['locationName'] && !entry['external'] && !entry['destination']) {
          newComponent["quantityDonated"] += entry["quantity"];
        } else if (entry['external']) {
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
      if (currentEntry['locationName'] && currentEntry['destination'] && !currentEntry['external']) {
        //Item moves
        entryCell.textContent = `${currentEntry['quantity']} ${currentEntry['componentType']} moved from ${currentEntry['locationName']} to ${currentEntry['destination']} by ${currentEntry['whoDonated']}`;
      } else if (currentEntry['locationName'] && !currentEntry['external']) {
        //Item donated
        entryCell.textContent = `${currentEntry['quantity']} ${currentEntry['componentType']} donated to ${currentEntry['locationName']} by ${currentEntry['whoDonated']}`
      } else {
        //Item distributed
        entryCell.textContent = `${currentEntry['quantity']} ${currentEntry['componentType']} distributed from ${currentEntry['locationName']} to ${currentEntry['destination']} by ${currentEntry['whoDonated']}`
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

async function generateReport(generateForm: HTMLFormElement) {
  //Create a generating report message
  createMessage("Generating inventory report...", "report-message", "info");
  let formData: FormData = new FormData(generateForm);
  let startDateValue = formData.get("start-date-input");
  let endDateValue = formData.get("end-date-input");
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
  generateForm.classList.add('hide');
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
        generateForm.classList.remove('hide');
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

async function submitComponentData(formData: FormData) {
  const currentInventoryCard = document.getElementById('current-inventory-card');
  const newComponent: Component = {
    componentId: "",
    componentType: ""
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
      const componentId = await addNewComponent(newComponent);
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
          const newLoctionItem: LocationItem = {
            locationId: "all",
            locationName: "all",
            componentId: newComponent['componentId'],
            componentType: newComponent['componentType'],
            quantity: 0
          }
          const newRow = addNewRow(newLoctionItem, true);
          currentInventoryTableBody.appendChild(newRow);
        } else {
          //If the table body does not exist, create/load the table
          if (currentInventoryCard) {
            loadCurrentInventory(currentInventoryCard, "admin");
          }
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

async function submitLocationData(formData: FormData) {
  const newLocationInput = formData.get("new-location-input");
  if (newLocationInput === null || newLocationInput.toString().trim() === "") {
    createMessage(
      "Please enter the name of the new storage Location",
      "manage-inventory-message",
      "error",
    );
  } else {
    const externalCheckbox = formData.get('external-checkbox');
    const newLocation: Location = {
      locationId: "",
      locationName: newLocationInput.toString(),
      external: externalCheckbox ? true : false
    }
    console.log(newLocation['external']);
    await addNewLocation(newLocation);
    closeModal("manage-inventory-backdrop");
    loadManageLocationsCard();
  }
}

function loadAddNewComponentModal() {
  manageInventoryModal.innerHTML = '';
  const newForm = manageInventoryModal.cloneNode(true) as HTMLFormElement;
  manageInventoryModal.parentNode?.replaceChild(newForm, manageInventoryModal);
  manageInventoryModal = newForm;
  //Create the form to add a new component type
  const addNewComponentTypeForm = makeElement("form", "new-component-form", null, null) as HTMLFormElement;
  const formHeaderH2 = makeElement("h2", null, null, "Add a New Component Type");
  addNewComponentTypeForm.appendChild(formHeaderH2);
  const nameInputRow = createInput("text", "nameInput", "Name of new component type:", "form-row");
  addNewComponentTypeForm.appendChild(nameInputRow);
  const buttonRow = makeElement("section", null, "button-row", null);
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
    submitComponentData(data);
  });
  //Add the form to the modal
  manageInventoryModal.appendChild(addNewComponentTypeForm);
  //Open the modal
  openModal(manageInventoryBackdrop, manageInventoryModal, "nameInput");
}

function loadAddNewLocationModal() {
  manageInventoryModal.innerHTML = '';
  const newForm = manageInventoryModal.cloneNode(true) as HTMLFormElement;
  manageInventoryModal.parentNode?.replaceChild(newForm, manageInventoryModal);
  manageInventoryModal = newForm;
  const newLocationForm = makeElement("form", "new-location-form", null, null) as HTMLFormElement;
  const formHeaderH2 = makeElement("h2", null, null, "Add a New storage location");
  newLocationForm.appendChild(formHeaderH2);
  const newLocationInput = createInput("text", "new-location-input", "Storage Location:", "form-row");
  newLocationForm.appendChild(newLocationInput);
  const externalFormRow = makeElement("section", null, "form-row", null);
  const externalLabel = makeElement("span", null, null, "External:");
  externalFormRow.appendChild(externalLabel);
  const externalCheckbox = createCheckbox("External", "Internal", "external-checkbox", false, false);
  externalFormRow.appendChild(externalCheckbox);
  newLocationForm.appendChild(externalFormRow);
  const buttonRow = makeElement("section", null, "button-row", null);
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
  newLocationForm.appendChild(buttonRow);
  newLocationForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(newLocationForm);
    submitLocationData(data);
  });
  //Add the form to the modal
  manageInventoryModal.appendChild(newLocationForm);
  //Open the modal
  openModal(manageInventoryBackdrop, manageInventoryModal, "newLocationInput");
}

async function loadManageLocationsCard() {
  const manageLocationsCard = document.getElementById('manage-storage-locations-card') as HTMLElement;
  manageLocationsCard.innerHTML = '';
  const manageInventoryCard = document.getElementById('manage-inventory-card') as HTMLElement;
  const cardHeading = makeElement("h2", null, null, "Manage Storage Locations");
  manageLocationsCard.appendChild(cardHeading);
  //Get storage locations
  const storageLocations: Location[] = await getListOfLocations();

  if (storageLocations.length === 0) {
    const noLocations = makeElement("p", null, null, "No storage locations");
    manageLocationsCard.appendChild(noLocations)
  } else {
    const storageLocationsTable = makeElement("table", "storage-locations-table", null, null);
    const colGroup = makeElement("colgroup", null, null, null);
    const col1 = document.createElement("col");
    col1.setAttribute("style", "width: auto");
    colGroup.appendChild(col1);
    const col2 = document.createElement("col");
    col2.setAttribute("style", "width: 100px");
    colGroup.appendChild(col2);
    storageLocationsTable.appendChild(colGroup);
    const tableHead = makeElement("thead", null, null, null);
    const locationHeader = makeElement("th", null, null, "Location");
    tableHead.appendChild(locationHeader);
    const removeHeader = makeElement("th", null, null, "Remove Location");
    tableHead.appendChild(removeHeader);
    storageLocationsTable.appendChild(tableHead);
    const tableBody = makeElement("tbody", null, null, null);
    storageLocations.forEach(location => {
      const locationRow = makeElement("tr", location['locationId'].toString(), null, null);
      const locationTd = makeElement("td", null, null, `${location['locationName']} (${location['external'] ? 'External' : 'Internal'})`);
      locationRow.appendChild(locationTd);
      const deleteLocationTd = makeElement("td", null, null, null);
      const deleteButton = createButton("", "button", "delete-button", "delete-button-icon", "delete");
      deleteButton.addEventListener('click', () => {
        const buttonRow = createDeleteModal(location, `Are you sure you want to delete the location ${location['locationName']}?`);
        if (buttonRow) {
          const noButton = buttonRow.children[0];
          const yesButton = buttonRow.children[1];
          if (yesButton) {
            yesButton.addEventListener('click', async () => {
              closeModal("delete-item-backdrop");
              try {
                await deleteLocation(location['locationId']);
                createMessage(`Deleted ${location['locationName']}`, "main-message", "delete");
                locationRow.remove();
              } catch (error: any) {
                createMessage(error, "main-message", "error");
              }

            });
          }
          if (noButton) {
            noButton.addEventListener('click', () => {
              closeModal("delete-item-backdrop");
            });
          }
        }
      });
      deleteLocationTd.appendChild(deleteButton);
      locationRow.appendChild(deleteLocationTd);
      tableBody.appendChild(locationRow);
    });


    manageLocationsCard.appendChild(storageLocationsTable);
    storageLocationsTable.appendChild(tableBody);
  }

  const actionRow = makeElement("section", null, "button-row", null);
  const addNewStorageLocationButton = createButton("Add New Storage Location", "button", "add-new-location", "secondary", "add_location_alt");
  addNewStorageLocationButton.addEventListener('click', () => {
    loadAddNewLocationModal();
  });
  actionRow.appendChild(addNewStorageLocationButton);
  const closeLocationsCardButton = createButton("Done", "button", "close-locations-button", "secondary");
  closeLocationsCardButton.addEventListener('click', () => {
    manageLocationsCard.classList.add('hide');
    manageInventoryCard.classList.remove('hide');
  });
  actionRow.appendChild(closeLocationsCardButton);
  manageLocationsCard.appendChild(actionRow);
  manageInventoryCard.classList.add('hide');
  manageLocationsCard.classList.remove('hide');
}