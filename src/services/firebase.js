/**
 * ESA OS
 * Firebase Service
 *
 * Responsável por centralizar toda comunicação com Firebase.
 *
 * Nesta primeira versão é apenas um contrato.
 * Nenhuma funcionalidade do Dashboard será alterada.
 */

export class FirebaseService {

    constructor() {
        this.initialized = false;
    }

    initialize() {
        console.log("[ESA CORE] Firebase Service iniciado.");
        this.initialized = true;
    }

    isInitialized() {
        return this.initialized;
    }

}