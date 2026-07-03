/**
 * ESA OS
 * Core Bootstrap
 *
 * Primeira versão do núcleo da plataforma.
 *
 * IMPORTANTE:
 * Ainda não está conectado ao Dashboard.
 */

import { FirebaseService } from "../services/firebase.js";

class ESAApplication {

    constructor() {

        this.version = "2.0.0-alpha";

        this.firebase = new FirebaseService();

    }

    initialize() {

        console.log("==================================");
        console.log("ESA OS");
        console.log("Versão:", this.version);
        console.log("Inicializando plataforma...");
        console.log("==================================");

        this.firebase.initialize();

        console.log("ESA OS iniciada com sucesso.");

    }

}

export const ESA = new ESAApplication();