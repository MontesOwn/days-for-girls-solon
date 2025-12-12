const docElm = document.documentElement;
let preference = false;
const preferenceLS = sessionStorage.getItem("darkMode");
if (preferenceLS) {
  preference = JSON.parse(preferenceLS);
} else {
  preference = window.matchMedia("(prefers-color-scheme: dark)").matches;
  sessionStorage.setItem("darkMode", JSON.stringify(preference));
}
setDarkMode(preference);

function setDarkMode(preference: boolean) {
  if (preference) {
    docElm.classList.add("dark");
    docElm.classList.remove("light");
  } else {
    docElm.classList.add("light");
    docElm.classList.remove("dark");
  }
}