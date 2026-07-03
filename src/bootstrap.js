import { ESA } from "./core/app.js";

window.addEventListener("DOMContentLoaded", () => {

    console.log("=================================");
    console.log("ESA OS Bootstrap");
    console.log("=================================");

    ESA.initialize();

    window.ESA_OS = ESA;

});