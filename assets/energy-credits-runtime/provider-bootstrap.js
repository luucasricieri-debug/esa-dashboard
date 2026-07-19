(function() {
	//#region ../../../services/firebase.js
	/**
	* ESA OS
	* Firebase Service
	*
	* Responsável por centralizar toda comunicação com Firebase.
	*
	* Nesta primeira versão é apenas um contrato.
	* Nenhuma funcionalidade do Dashboard será alterada.
	*/
	var FirebaseService = class {
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
	};
	//#endregion
	//#region ../../../core/events/event.js
	/**
	* Representa um evento interno imutável da plataforma ESA OS.
	*/
	var CoreEvent = class CoreEvent {
		/**
		* @param {string} type      - Tipo do evento (use EVENT_TYPES.*)
		* @param {Object} payload   - Dados carregados pelo evento
		* @param {string} source    - Identificador do módulo que publicou (ex: 'CRMDomain')
		* @param {Object} metadata  - Dados extras para rastreabilidade
		*/
		constructor(type, payload = {}, source = "", metadata = {}) {
			/** @type {string} Identificador único gerado no momento da criação */
			this.id = CoreEvent._generateId();
			/** @type {string} Tipo do evento no formato 'domain:entity:verb' */
			this.type = type;
			/** @type {Object} Dados transportados pelo evento */
			this.payload = payload;
			/** @type {string} Módulo ou classe que publicou o evento */
			this.source = source;
			/** @type {number} Timestamp de criação em ms desde epoch (imutável) */
			this.createdAt = Date.now();
			/**
			* @type {Object} Metadados para correlação e rastreamento.
			* Campos sugeridos: correlationId, traceId, userId, requestId
			*
			* TODO: Gerar correlationId automaticamente se não fornecido
			* TODO: Propagar traceId entre eventos causalmente relacionados
			*/
			this.metadata = metadata;
		}
		/**
		* Retorna o domain de origem extraído do tipo do evento.
		* @returns {string} - Ex: 'crm' para 'crm:deal:created'
		*/
		getDomain() {
			return this.type.split(":")[0] || "";
		}
		/**
		* Retorna a entidade extraída do tipo do evento.
		* @returns {string} - Ex: 'deal' para 'crm:deal:created'
		*/
		getEntity() {
			return this.type.split(":")[1] || "";
		}
		/**
		* Retorna o verbo/ação extraído do tipo do evento.
		* @returns {string} - Ex: 'created' para 'crm:deal:created'
		*/
		getVerb() {
			return this.type.split(":")[2] || "";
		}
		/**
		* Verifica se este evento é do tipo informado.
		* @param {string} type
		* @returns {boolean}
		*/
		isType(type) {
			return this.type === type;
		}
		/**
		* Serializa o evento para objeto plano (para log ou transporte).
		* @returns {Object}
		*/
		toJSON() {
			return {
				id: this.id,
				type: this.type,
				payload: this.payload,
				source: this.source,
				createdAt: this.createdAt,
				metadata: this.metadata
			};
		}
		/**
		* Reconstrói um CoreEvent a partir de objeto serializado.
		* Preserva id e createdAt originais — não gera novos.
		* @param {Object} data
		* @returns {CoreEvent}
		*/
		static fromJSON(data) {
			const event = new CoreEvent(data.type || "", data.payload || {}, data.source || "", data.metadata || {});
			event.id = data.id || event.id;
			event.createdAt = data.createdAt || event.createdAt;
			return event;
		}
		/**
		* Gera um identificador único para o evento.
		* Usa crypto.randomUUID() quando disponível; fallback seguro para ambientes sem suporte.
		* @returns {string}
		* @private
		*/
		static _generateId() {
			if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
			return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
		}
	};
	//#endregion
	//#region ../../../core/events/subscriber.js
	/**
	* ESA OS — Core / Events
	* Subscriber
	*
	* Representa um consumidor de eventos no Event Bus da plataforma ESA OS.
	* Encapsula o handler de processamento e os metadados de inscrição.
	*
	* Responsabilidades:
	* - Representar a inscrição de um módulo em um ou mais tipos de evento
	* - Armazenar o handler (callback) a ser invocado quando o evento ocorrer
	* - Controlar o estado ativo/inativo da inscrição
	* - Suportar inscrição pontual (once) — auto-remove após primeiro disparo
	* - Prover identificação rastreável para remoção pelo EventBus
	*
	* Wildcards suportados em eventTypes:
	*   '*'              — todos os eventos da plataforma
	*   'domain:*'       — todos os eventos de um domain (ex: 'crm:*')
	*   'domain:entity:*'— todos os eventos de uma entidade (ex: 'crm:deal:*')
	*
	* IMPORTANTE:
	* Este arquivo NÃO está conectado ao Dashboard legado (index.html).
	* Não processa eventos reais. Não altera nenhum comportamento da aplicação.
	*/
	/**
	* Representa um consumidor de eventos registrado no EventBus.
	*/
	var Subscriber = class {
		/**
		* @param {string}          id          - Identificador único desta inscrição
		* @param {string|string[]} eventTypes  - Tipo(s) de evento que este Subscriber consome
		* @param {Function}        handler     - Callback chamado com (CoreEvent) ao publicar
		* @param {string}          owner       - Identificador do módulo dono desta inscrição (ex: 'CRMDomain')
		* @param {boolean}         once        - Se true, remove-se automaticamente após o primeiro disparo
		*/
		constructor(id, eventTypes, handler, owner = "", once = false) {
			/** @type {string} */
			this.id = id;
			/** @type {string[]} Tipos de evento aceitos — normalizado sempre como array */
			this.eventTypes = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
			/**
			* @type {Function} Callback de processamento.
			* Assinatura esperada: (event: CoreEvent) => void | Promise<void>
			*/
			this.handler = handler;
			/** @type {string} Módulo que registrou esta inscrição (para debug e auditoria) */
			this.owner = owner;
			/** @type {boolean} Se true, este Subscriber se auto-remove após o primeiro disparo */
			this.once = once;
			/** @type {boolean} Controla se a inscrição está ativa */
			this.active = true;
			/** @type {number} Quantas vezes o handler foi invocado */
			this.invokeCount = 0;
			/** @type {number} Timestamp de criação da inscrição */
			this.createdAt = Date.now();
		}
		/**
		* Verifica se este Subscriber aceita um determinado tipo de evento.
		* Suporta matching exato, '*', 'domain:*' e 'domain:entity:*'.
		* @param {string} eventType
		* @returns {boolean}
		*/
		handles(eventType) {
			return this.eventTypes.some((pattern) => {
				if (pattern === "*") return true;
				if (pattern === eventType) return true;
				if (pattern.endsWith(":*")) return eventType.startsWith(pattern.slice(0, -1));
				return false;
			});
		}
		/**
		* Invoca o handler com o evento recebido.
		* Suporta handlers síncronos e assíncronos.
		* Erros propagam para o EventBus — não são engolidos aqui.
		* @param {CoreEvent} event
		* @returns {Promise<void>}
		*/
		async dispatch(event) {
			if (!this.active) return;
			await this.handler(event);
			this.invokeCount++;
			if (this.once) this.deactivate();
		}
		/**
		* Ativa esta inscrição (reativa após desativação).
		*/
		activate() {
			this.active = true;
		}
		/**
		* Desativa esta inscrição sem removê-la do EventBus.
		* Eventos continuam sendo roteados, mas o handler não é invocado.
		*/
		deactivate() {
			this.active = false;
		}
		/**
		* Verifica se esta inscrição está ativa.
		* @returns {boolean}
		*/
		isActive() {
			return this.active;
		}
		/**
		* Serializa o Subscriber para log ou diagnóstico.
		* Nunca inclui o handler (não serializável).
		* @returns {Object}
		*/
		toJSON() {
			return {
				id: this.id,
				eventTypes: this.eventTypes,
				owner: this.owner,
				once: this.once,
				active: this.active,
				invokeCount: this.invokeCount,
				createdAt: this.createdAt
			};
		}
	};
	//#endregion
	//#region ../../../core/events/event-bus.js
	/**
	* ESA OS — Core / Events
	* EventBus
	*
	* Barramento de eventos da plataforma ESA OS.
	* Implementa o padrão Publish/Subscribe para comunicação desacoplada
	* entre Core, Domains e Services.
	*
	* Responsabilidades:
	* - Registrar Subscribers por tipo de evento
	* - Rotear CoreEvents publicados para os Subscribers correspondentes
	* - Remover Subscribers quando não forem mais necessários
	* - Manter histórico em memória dos eventos publicados (ring buffer)
	* - Prover diagnóstico de subscribers ativos e histórico de eventos
	*
	* Modelo de comunicação:
	*   Publisher  →  EventBus.publish(event)  →  [Subscriber A, Subscriber B, ...]
	*
	* Garantias:
	*   - Entrega best-effort (sem retry automático nesta fase)
	*   - Ordem de entrega: FIFO por tipo de evento
	*   - Isolamento: erro em um Subscriber não afeta os demais
	*   - Deduplicação: um Subscriber nunca é chamado duas vezes pelo mesmo evento
	*
	* IMPORTANTE:
	* Este arquivo NÃO está conectado ao Dashboard legado (index.html).
	* O EventBus opera exclusivamente em memória — sem persistência.
	* Não integrado com Logger nem Audit nesta fase.
	*/
	/**
	* Capacidade máxima do histórico em memória.
	* Ao atingir o limite, os eventos mais antigos são descartados (ring buffer).
	*
	* TODO: Tornar configurável via ESA_CORE_CONFIG
	*/
	var DEFAULT_HISTORY_LIMIT$2 = 500;
	/**
	* Barramento central de eventos da plataforma ESA OS.
	*/
	var EventBus = class {
		/**
		* @param {number} historyLimit - Máximo de eventos mantidos em memória
		*/
		constructor(historyLimit = DEFAULT_HISTORY_LIMIT$2) {
			/**
			* @type {Map<string, Set<Subscriber>>}
			* Mapa de eventType (incluindo wildcards) → conjunto de Subscribers.
			*/
			this._subscribers = /* @__PURE__ */ new Map();
			/**
			* @type {CoreEvent[]}
			* Histórico em memória dos eventos publicados (ring buffer).
			*/
			this._history = [];
			/** @type {number} */
			this._historyLimit = historyLimit;
			/** @type {number} Total de eventos publicados desde a inicialização */
			this._publishedCount = 0;
			/** @type {boolean} Se true, loga eventos no console (modo debug) */
			this._debug = false;
		}
		/**
		* Registra um Subscriber para um ou mais tipos de evento.
		*
		* @param {string|string[]} eventTypes - Tipo(s) de evento a escutar (suporta wildcards)
		* @param {Function}        handler    - Callback (event: CoreEvent) => void | Promise<void>
		* @param {Object}          options
		* @param {string}          options.owner - Módulo dono da inscrição
		* @param {boolean}         options.once  - Remove após primeiro disparo
		* @returns {string} subscriberId
		*/
		subscribe(eventTypes, handler, options = {}) {
			if (typeof handler !== "function") throw new TypeError("[EventBus] handler must be a function");
			const types = Array.isArray(eventTypes) ? eventTypes : [eventTypes];
			const id = CoreEvent._generateId();
			const sub = new Subscriber(id, types, handler, options.owner || "", options.once || false);
			for (const type of types) {
				if (!this._subscribers.has(type)) this._subscribers.set(type, /* @__PURE__ */ new Set());
				this._subscribers.get(type).add(sub);
			}
			if (this._debug) console.debug(`[EventBus] subscribe ${id} -> [${types.join(", ")}]`);
			return id;
		}
		/**
		* Registra um Subscriber que se remove automaticamente após o primeiro disparo.
		* @param {string|string[]} eventTypes
		* @param {Function}        handler
		* @param {Object}          options
		* @returns {string} subscriberId
		*/
		subscribeOnce(eventTypes, handler, options = {}) {
			return this.subscribe(eventTypes, handler, {
				...options,
				once: true
			});
		}
		/**
		* Remove uma inscrição pelo subscriberId retornado em subscribe().
		* @param {string} subscriberId
		* @returns {boolean} - true se a inscrição foi encontrada e removida
		*/
		unsubscribe(subscriberId) {
			let found = false;
			for (const [key, set] of this._subscribers) {
				const toRemove = [];
				for (const sub of set) if (sub.id === subscriberId) toRemove.push(sub);
				for (const sub of toRemove) {
					set.delete(sub);
					found = true;
				}
				if (set.size === 0) this._subscribers.delete(key);
			}
			return found;
		}
		/**
		* Remove todas as inscrições de um módulo (owner) de uma vez.
		* @param {string} owner - Identificador do módulo (ex: 'CRMDomain')
		* @returns {number} - Quantidade de Subscribers únicos removidos
		*/
		unsubscribeAll(owner) {
			const removed = /* @__PURE__ */ new Set();
			for (const [key, set] of this._subscribers) {
				const toRemove = [];
				for (const sub of set) if (sub.owner === owner) toRemove.push(sub);
				for (const sub of toRemove) {
					set.delete(sub);
					removed.add(sub.id);
				}
				if (set.size === 0) this._subscribers.delete(key);
			}
			return removed.size;
		}
		/**
		* Publica um CoreEvent, entregando-o a todos os Subscribers correspondentes.
		* Rota para matches exatos e wildcards (* / domain:* / domain:entity:*).
		* Erros em Subscribers individuais são isolados — não interrompem os demais.
		*
		* @param {CoreEvent} event
		* @returns {Promise<number>} - Quantidade de Subscribers notificados com sucesso
		*/
		async publish(event) {
			if (!(event instanceof CoreEvent)) throw new TypeError("[EventBus] publish() requires a CoreEvent instance");
			this._history.push(event);
			if (this._history.length > this._historyLimit) this._history.shift();
			this._publishedCount++;
			if (this._debug) console.debug(`[EventBus] publish ${event.type} (id: ${event.id})`);
			const subscribers = this._resolveSubscribers(event.type);
			let successCount = 0;
			for (const sub of subscribers) {
				if (!sub.active) continue;
				try {
					await sub.dispatch(event);
					successCount++;
				} catch (err) {
					if (this._debug) console.error(`[EventBus] Error in subscriber "${sub.id}" (owner: "${sub.owner}"):`, err);
				}
				if (!sub.active) this.unsubscribe(sub.id);
			}
			return successCount;
		}
		/**
		* Retorna o histórico de eventos publicados em memória.
		* @param {string} [eventType] - Filtro opcional por tipo de evento
		* @returns {CoreEvent[]}
		*/
		getHistory(eventType = "") {
			if (eventType) return this._history.filter((e) => e.type === eventType).slice();
			return this._history.slice();
		}
		/**
		* Retorna os Subscribers ativos, opcionalmente filtrados por tipo de evento.
		* Deduplicado — um Subscriber registrado em múltiplos tipos aparece uma única vez.
		* @param {string} [eventType]
		* @returns {Subscriber[]}
		*/
		listSubscribers(eventType = "") {
			const seen = /* @__PURE__ */ new Set();
			const result = [];
			const collectActive = (set) => {
				if (!set) return;
				for (const sub of set) if (sub.active && !seen.has(sub.id)) {
					seen.add(sub.id);
					result.push(sub);
				}
			};
			if (eventType) collectActive(this._subscribers.get(eventType));
			else for (const set of this._subscribers.values()) collectActive(set);
			return result;
		}
		/**
		* Limpa o histórico de eventos em memória.
		* Não remove Subscribers registrados.
		*/
		clearHistory() {
			this._history = [];
		}
		/**
		* Remove todos os Subscribers e limpa o histórico.
		* Útil para reinicialização controlada (testes, hot-reload).
		*/
		reset() {
			this._subscribers = /* @__PURE__ */ new Map();
			this._history = [];
			this._publishedCount = 0;
		}
		/**
		* Ativa ou desativa o modo debug (log de eventos no console).
		* @param {boolean} enabled
		*/
		setDebug(enabled) {
			this._debug = Boolean(enabled);
		}
		/**
		* Retorna um snapshot de diagnóstico do estado atual do EventBus.
		* @returns {{ subscriberCount: number, publishedCount: number, historyLength: number, debug: boolean }}
		*/
		getStats() {
			const seen = /* @__PURE__ */ new Set();
			for (const set of this._subscribers.values()) for (const sub of set) seen.add(sub.id);
			return {
				subscriberCount: seen.size,
				publishedCount: this._publishedCount,
				historyLength: this._history.length,
				debug: this._debug
			};
		}
		/**
		* Coleta Subscribers de uma chave do Map, deduplicando por id.
		* @param {string}        key
		* @param {Set<string>}   seen
		* @param {Subscriber[]}  result
		* @private
		*/
		_collectSubscribers(key, seen, result) {
			const set = this._subscribers.get(key);
			if (!set) return;
			for (const sub of set) if (!seen.has(sub.id)) {
				seen.add(sub.id);
				result.push(sub);
			}
		}
		/**
		* Resolve todos os Subscribers que devem receber um evento do tipo dado,
		* incluindo wildcards (* / domain:* / domain:entity:*).
		* @param {string} eventType
		* @returns {Subscriber[]}
		* @private
		*/
		_resolveSubscribers(eventType) {
			const seen = /* @__PURE__ */ new Set();
			const result = [];
			const parts = eventType.split(":");
			this._collectSubscribers(eventType, seen, result);
			this._collectSubscribers("*", seen, result);
			if (parts.length >= 1) this._collectSubscribers(`${parts[0]}:*`, seen, result);
			if (parts.length >= 2) this._collectSubscribers(`${parts[0]}:${parts[1]}:*`, seen, result);
			return result;
		}
	};
	//#endregion
	//#region ../../../core/events/index.js
	/**
	* Instância singleton do EventBus da plataforma ESA OS.
	*
	* Use esta instância em toda a plataforma para garantir
	* que todos os Domains compartilhem o mesmo barramento.
	*
	* TODO: Inicializar via ESAApplication ao invés de eager instantiation
	* TODO: Expor como window.ESA_OS.eventBus para diagnóstico em dev mode
	*/
	var eventBus = new EventBus();
	//#endregion
	//#region ../../../core/audit/audit-action.js
	/**
	* ESA OS — Core / Audit
	* AuditAction
	*
	* Catálogo de ações auditáveis da plataforma ESA OS.
	* Define o vocabulário controlado de operações registradas na trilha de auditoria.
	*
	* Responsabilidades:
	* - Centralizar todos os tipos de ação reconhecidos pelo sistema de auditoria
	* - Prover metadados (label, categoria) para cada ação
	* - Ser a única fonte de verdade — nunca usar strings literais nos módulos
	*
	* IMPORTANTE:
	* Este arquivo NÃO está conectado ao Dashboard legado (index.html).
	* Não altera nenhum comportamento da aplicação em produção.
	*/
	/**
	* Ações auditáveis disponíveis na plataforma.
	*
	* TODO: Expandir conforme novos domains forem implementados
	* TODO: Persistir catálogo no banco para consulta via painel de compliance
	*/
	var AUDIT_ACTION = {
		CREATE: "CREATE",
		READ: "READ",
		UPDATE: "UPDATE",
		DELETE: "DELETE",
		LOGIN: "LOGIN",
		LOGOUT: "LOGOUT",
		ACCESS: "ACCESS",
		EXPORT: "EXPORT",
		IMPORT: "IMPORT",
		MOVE: "MOVE",
		APPROVE: "APPROVE",
		REJECT: "REJECT",
		EXECUTE: "EXECUTE"
	};
	AUDIT_ACTION.CREATE, AUDIT_ACTION.READ, AUDIT_ACTION.UPDATE, AUDIT_ACTION.DELETE, AUDIT_ACTION.LOGIN, AUDIT_ACTION.LOGOUT, AUDIT_ACTION.ACCESS, AUDIT_ACTION.EXPORT, AUDIT_ACTION.IMPORT, AUDIT_ACTION.MOVE, AUDIT_ACTION.APPROVE, AUDIT_ACTION.REJECT, AUDIT_ACTION.EXECUTE;
	//#endregion
	//#region ../../../core/audit/audit-context.js
	/**
	* ESA OS — Core / Audit
	* AuditContext
	*
	* Mantém o contexto de execução de uma operação auditada.
	* É propagado junto com AuditEntry para enriquecer a trilha de auditoria
	* com dados do ambiente em que a ação ocorreu.
	*
	* Responsabilidades:
	* - Capturar quem executou a ação (personId, organizationId)
	* - Capturar de onde a ação foi executada (ip, userAgent, sessionId)
	* - Prover correlationId para rastreamento entre múltiplos sistemas
	* - Ser construído uma vez por operação e reutilizado em todas as entradas dela
	*
	* IMPORTANTE:
	* Este arquivo NÃO está conectado ao Dashboard legado (index.html).
	* Não coleta dados reais de rede ou browser.
	*/
	/**
	* Contexto de execução de uma operação auditada.
	*/
	var AuditContext = class AuditContext {
		/**
		* @param {string} organizationId - ID da organização onde a ação ocorreu
		* @param {string} personId       - UID da Person que executou a ação
		* @param {string} sessionId      - ID da sessão ativa no momento da ação
		* @param {string} source         - Módulo de origem (ex: 'CRMDomain', 'IdentityDomain')
		* @param {string} ip             - Endereço IP do cliente (coletado pelo servidor)
		* @param {string} userAgent      - User-Agent do browser/cliente
		* @param {string} correlationId  - ID de correlação para rastrear operações relacionadas
		*/
		constructor(organizationId = "", personId = "", sessionId = "", source = "", ip = "", userAgent = "", correlationId = "") {
			this.organizationId = organizationId;
			this.personId = personId;
			this.sessionId = sessionId;
			this.source = source;
			this.ip = ip;
			this.userAgent = userAgent;
			this.correlationId = correlationId;
			/** @type {number} Timestamp de criação do contexto */
			this.createdAt = Date.now();
		}
		/**
		* Verifica se o contexto possui os campos mínimos obrigatórios.
		* Requer organizationId e personId não vazios.
		* sessionId e source podem ser vazios.
		* @returns {boolean}
		*/
		isValid() {
			return Boolean(this.organizationId) && Boolean(this.personId);
		}
		/**
		* Cria um AuditContext a partir de uma Session ativa.
		* @param {Session} session - Instância de Session do Identity Domain
		* @returns {AuditContext}
		*
		* TODO: Extrair personId e sessionId da Session
		* TODO: Extrair organizationId da Organization associada à Session
		*/
		static fromSession(session) {
			return new AuditContext();
		}
		/**
		* Serializa o contexto para inclusão em AuditEntry ou persistência.
		* @returns {Object}
		*/
		toJSON() {
			return {
				organizationId: this.organizationId,
				personId: this.personId,
				sessionId: this.sessionId,
				source: this.source,
				ip: this.ip,
				userAgent: this.userAgent,
				correlationId: this.correlationId,
				createdAt: this.createdAt
			};
		}
		/**
		* Reconstrói um AuditContext a partir de objeto serializado.
		* Preserva todos os campos, incluindo createdAt original.
		* Não acessa browser, navigator ou IP real.
		* @param {Object} data
		* @returns {AuditContext}
		*/
		static fromJSON(data) {
			const ctx = new AuditContext(data.organizationId || "", data.personId || "", data.sessionId || "", data.source || "", data.ip || "", data.userAgent || "", data.correlationId || "");
			if (data.createdAt != null) ctx.createdAt = data.createdAt;
			return ctx;
		}
	};
	//#endregion
	//#region ../../../core/audit/audit-entry.js
	/**
	* ESA OS — Core / Audit
	* AuditEntry
	*
	* Representa um registro imutável na trilha de auditoria da plataforma ESA OS.
	* Cada operação relevante gera uma AuditEntry com snapshot do estado antes e depois.
	*
	* Responsabilidades:
	* - Armazenar o registro completo de uma ação auditada
	* - Capturar estado anterior (before) e posterior (after) do recurso
	* - Vincular a ação ao contexto (quem, quando, de onde)
	* - Ser imutável após criação — trilhas de auditoria não são editáveis
	*
	* IMPORTANTE:
	* Este arquivo NÃO está conectado ao Dashboard legado (index.html).
	* Não persiste dados. Apenas modela a estrutura do registro.
	*/
	/** Campos de controle que não entram no diff — mudam sem representar alteração de dados. */
	var DIFF_IGNORED_FIELDS = /* @__PURE__ */ new Set([
		"createdAt",
		"updatedAt",
		"timestamp"
	]);
	/** Conjunto de ações que classificam uma entrada como modificação de dados. */
	var MODIFICATION_ACTIONS = /* @__PURE__ */ new Set([
		AUDIT_ACTION.UPDATE,
		AUDIT_ACTION.MOVE,
		AUDIT_ACTION.APPROVE,
		AUDIT_ACTION.REJECT
	]);
	/**
	* Registro imutável de uma ação auditada.
	*/
	var AuditEntry = class AuditEntry {
		/**
		* @param {string}      action         - Ação realizada: AUDIT_ACTION.*
		* @param {string}      resource       - Tipo do recurso afetado (ex: 'deal', 'user', 'session')
		* @param {string}      resourceId     - ID do recurso afetado
		* @param {string}      organizationId - ID da organização onde ocorreu
		* @param {string}      personId       - UID da Person que executou
		* @param {string}      source         - Módulo de origem (ex: 'CRMDomain')
		* @param {Object|null} before         - Snapshot do estado do recurso antes da ação
		* @param {Object|null} after          - Snapshot do estado do recurso após a ação
		* @param {Object}      metadata       - Dados extras (correlationId, sessionId, ip)
		*/
		constructor(action, resource, resourceId, organizationId = "", personId = "", source = "", before = null, after = null, metadata = {}) {
			/** @type {string} Identificador único imutável desta entrada */
			this.id = AuditEntry._generateId();
			this.action = action;
			this.resource = resource;
			this.resourceId = resourceId;
			this.organizationId = organizationId;
			this.personId = personId;
			this.source = source;
			/** @type {number} Timestamp de criação (ms desde epoch) — imutável */
			this.timestamp = Date.now();
			/**
			* @type {Object|null} Estado do recurso ANTES da operação.
			* null para ações CREATE e LOGIN (não havia estado anterior).
			*
			* TODO: Sanitizar campos sensíveis (passHash, tokens) antes de armazenar
			*/
			this.before = before;
			/**
			* @type {Object|null} Estado do recurso APÓS a operação.
			* null para ações DELETE e LOGOUT (recurso não existe mais).
			*
			* TODO: Sanitizar campos sensíveis antes de armazenar
			*/
			this.after = after;
			this.metadata = metadata;
		}
		/**
		* Verifica se esta entrada registrou uma modificação de dados.
		* Retorna true para UPDATE, MOVE, APPROVE e REJECT.
		* @returns {boolean}
		*/
		isModification() {
			return MODIFICATION_ACTIONS.has(this.action);
		}
		/**
		* Verifica se esta entrada registrou uma remoção.
		* Retorna true somente para DELETE.
		* @returns {boolean}
		*/
		isDeletion() {
			return this.action === AUDIT_ACTION.DELETE;
		}
		/**
		* Calcula o diff entre before e after.
		*
		* Compara a união das chaves de before e after usando Object.is().
		* Ignora campos de controle de tempo: createdAt, updatedAt, timestamp.
		* Suporta before null (tratado como {}) e after null (tratado como {}).
		* Não implementa deep diff — comparação apenas no nível raiz.
		* Não muta before ou after.
		*
		* @returns {Object} Mapa { [campo]: { from, to } } para cada campo alterado
		*/
		getDiff() {
			const before = this.before || {};
			const after = this.after || {};
			const keys = /* @__PURE__ */ new Set([...Object.keys(before), ...Object.keys(after)]);
			const diff = {};
			for (const key of keys) {
				if (DIFF_IGNORED_FIELDS.has(key)) continue;
				if (!Object.is(before[key], after[key])) diff[key] = {
					from: before[key],
					to: after[key]
				};
			}
			return diff;
		}
		/**
		* Serializa a entrada para persistência ou transporte.
		* @returns {Object}
		*/
		toJSON() {
			return {
				id: this.id,
				organizationId: this.organizationId,
				personId: this.personId,
				action: this.action,
				resource: this.resource,
				resourceId: this.resourceId,
				source: this.source,
				timestamp: this.timestamp,
				before: this.before,
				after: this.after,
				metadata: this.metadata
			};
		}
		/**
		* Reconstrói uma AuditEntry a partir de objeto serializado.
		* Preserva id e timestamp originais — não gera novos.
		* @param {Object} data
		* @returns {AuditEntry}
		*/
		static fromJSON(data) {
			const entry = new AuditEntry(data.action || AUDIT_ACTION.READ, data.resource || "", data.resourceId || "", data.organizationId || "", data.personId || "", data.source || "", data.before ?? null, data.after ?? null, data.metadata || {});
			if (data.id) entry.id = data.id;
			if (data.timestamp) entry.timestamp = data.timestamp;
			return entry;
		}
		/**
		* Gera um identificador único para a entrada.
		* Usa crypto.randomUUID() quando disponível; fallback para ambientes sem suporte.
		* Nunca retorna ID vazio.
		* @returns {string}
		* @private
		*/
		static _generateId() {
			if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
			return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
		}
	};
	//#endregion
	//#region ../../../core/audit/audit.js
	/**
	* ESA OS — Core / Audit
	* Audit (Facade)
	*
	* Fachada principal do módulo de auditoria da plataforma ESA OS.
	* É o único ponto de entrada para registrar e consultar a trilha de auditoria.
	*
	* Responsabilidades:
	* - Receber chamadas de auditoria de qualquer módulo do ESA OS
	* - Criar AuditEntry a partir de AuditContext + dados da operação
	* - Armazenar entradas em memória (persistência via Firebase será implementada futuramente)
	* - Prover consultas filtradas por person, resource e action
	* - NÃO integrar com Logger ou Event Bus neste momento
	*
	* Padrão: Facade
	* Consumo: import { audit } from 'src/core/audit/index.js'
	*
	* IMPORTANTE:
	* Este arquivo NÃO está conectado ao Dashboard legado (index.html).
	* Não persiste dados. Não integra com Logger ou Event Bus.
	* Não altere nenhum arquivo existente.
	*/
	/**
	* Limite máximo de entradas mantidas em memória.
	*
	* TODO: Mover para src/core/config.js quando integrado
	*/
	var DEFAULT_HISTORY_LIMIT$1 = 5e3;
	/**
	* Facade de auditoria do ESA OS.
	* Instanciada como singleton no index.js.
	*/
	var Audit = class {
		constructor() {
			/** @type {AuditEntry[]} Trilha de auditoria em memória */
			this._entries = [];
			/** @type {number} Limite de entradas em memória (ring buffer) */
			this._historyLimit = DEFAULT_HISTORY_LIMIT$1;
		}
		/**
		* Registra uma ação auditada e adiciona ao histórico em memória.
		* Método principal — todos os módulos chamam este método.
		*
		* context.sessionId, ip, userAgent e correlationId são mesclados no metadata
		* automaticamente. Os metadata recebidos pelo chamador prevalecem em duplicatas.
		*
		* @param {AuditContext} context    - Contexto da operação (quem, quando, de onde)
		* @param {string}       action     - Ação realizada: AUDIT_ACTION.*
		* @param {string}       resource   - Tipo do recurso afetado (ex: 'deal')
		* @param {string}       resourceId - ID do recurso afetado
		* @param {Object|null}  before     - Estado do recurso antes da ação
		* @param {Object|null}  after      - Estado do recurso após a ação
		* @param {Object}       metadata   - Dados extras (prevalecem sobre context em duplicatas)
		* @returns {AuditEntry}
		*/
		record(context, action, resource, resourceId, before = null, after = null, metadata = {}) {
			this._validate(context, action, resource, resourceId);
			const mergedMeta = {
				sessionId: context.sessionId,
				ip: context.ip,
				userAgent: context.userAgent,
				correlationId: context.correlationId,
				...metadata
			};
			const entry = new AuditEntry(action, resource, resourceId, context.organizationId, context.personId, context.source, before, after, mergedMeta);
			this._entries.push(entry);
			if (this._entries.length > this._historyLimit) this._entries.shift();
			return entry;
		}
		/**
		* Cria uma AuditEntry sem adicioná-la à trilha.
		* Útil para construir a entrada antes de confirmar a operação.
		* Aplica as mesmas validações de record().
		*
		* @param {AuditContext} context
		* @param {string}       action
		* @param {string}       resource
		* @param {string}       resourceId
		* @param {Object|null}  before
		* @param {Object|null}  after
		* @returns {AuditEntry}
		*/
		createEntry(context, action, resource, resourceId, before = null, after = null) {
			this._validate(context, action, resource, resourceId);
			const mergedMeta = {
				sessionId: context.sessionId,
				ip: context.ip,
				userAgent: context.userAgent,
				correlationId: context.correlationId
			};
			return new AuditEntry(action, resource, resourceId, context.organizationId, context.personId, context.source, before, after, mergedMeta);
		}
		/**
		* Retorna as entradas da trilha, com filtros opcionais.
		* Ordenadas por timestamp DESC (mais recentes primeiro).
		* Retorna cópia — não expõe o array interno.
		*
		* @param {Object} filters
		* @param {string} [filters.action]         - Filtrar por ação (AUDIT_ACTION.*)
		* @param {string} [filters.resource]       - Filtrar por tipo de recurso
		* @param {string} [filters.resourceId]     - Filtrar por ID do recurso
		* @param {string} [filters.personId]       - Filtrar por quem executou
		* @param {string} [filters.organizationId] - Filtrar por organização
		* @param {string} [filters.source]         - Filtrar por módulo de origem
		* @param {number} [filters.from]           - Timestamp mínimo inclusivo (ms)
		* @param {number} [filters.to]             - Timestamp máximo inclusivo (ms)
		* @param {number} [limit=100]              - Máximo de resultados (<=0 = sem limite)
		* @returns {AuditEntry[]}
		*/
		getEntries(filters = {}, limit = 100) {
			let result = this._entries.slice().reverse();
			if (filters.action) result = result.filter((e) => e.action === filters.action);
			if (filters.resource) result = result.filter((e) => e.resource === filters.resource);
			if (filters.resourceId) result = result.filter((e) => e.resourceId === filters.resourceId);
			if (filters.personId) result = result.filter((e) => e.personId === filters.personId);
			if (filters.organizationId) result = result.filter((e) => e.organizationId === filters.organizationId);
			if (filters.source) result = result.filter((e) => e.source === filters.source);
			if (filters.from != null) result = result.filter((e) => e.timestamp >= filters.from);
			if (filters.to != null) result = result.filter((e) => e.timestamp <= filters.to);
			if (limit > 0) result = result.slice(0, limit);
			return result;
		}
		/**
		* Retorna todas as entradas registradas por uma Person específica.
		* Ordenadas por timestamp DESC.
		*
		* @param {string} personId
		* @param {number} [limit=100]
		* @returns {AuditEntry[]}
		*/
		findByPerson(personId, limit = 100) {
			return this.getEntries({ personId }, limit);
		}
		/**
		* Retorna todas as entradas relacionadas a um recurso específico.
		* Ordenadas cronologicamente ASC (histórico de evolução do recurso).
		*
		* @param {string} resource   - Tipo do recurso (ex: 'deal')
		* @param {string} resourceId - ID do recurso
		* @param {number} [limit=50]
		* @returns {AuditEntry[]}
		*/
		findByResource(resource, resourceId, limit = 50) {
			let result = this._entries.filter((e) => e.resource === resource && e.resourceId === resourceId);
			if (limit > 0) result = result.slice(0, limit);
			return result;
		}
		/**
		* Retorna todas as entradas de um tipo de ação específico.
		* Ordenadas por timestamp DESC.
		*
		* @param {string} action - AUDIT_ACTION.*
		* @param {number} [limit=100]
		* @returns {AuditEntry[]}
		*/
		findByAction(action, limit = 100) {
			return this.getEntries({ action }, limit);
		}
		/**
		* Limpa todas as entradas em memória.
		* Não registra nova AuditEntry.
		* NÃO remove entradas persistidas no Firebase.
		*
		* TODO: Proteger com verificação de permissão (somente DIRETOR)
		*/
		clear() {
			this._entries.length = 0;
		}
		/**
		* Retorna estatísticas da trilha em memória.
		* @returns {{ totalEntries, historyLimit, byAction, byResource, byOrganization }}
		*/
		getStats() {
			const byAction = {};
			const byResource = {};
			const byOrganization = {};
			for (const entry of this._entries) {
				byAction[entry.action] = (byAction[entry.action] || 0) + 1;
				byResource[entry.resource] = (byResource[entry.resource] || 0) + 1;
				byOrganization[entry.organizationId] = (byOrganization[entry.organizationId] || 0) + 1;
			}
			return {
				totalEntries: this._entries.length,
				historyLimit: this._historyLimit,
				byAction,
				byResource,
				byOrganization
			};
		}
		/**
		* Valida os parâmetros obrigatórios de record() e createEntry().
		* @private
		*/
		_validate(context, action, resource, resourceId) {
			if (!(context instanceof AuditContext)) throw new TypeError("[Audit] context must be an AuditContext instance");
			if (!context.isValid()) throw new Error("[Audit] context.isValid() is false — organizationId and personId are required");
			if (AUDIT_ACTION[action] === void 0) throw new Error(`[Audit] Unknown action: "${action}"`);
			if (typeof resource !== "string" || !resource.trim()) throw new Error("[Audit] resource must be a non-empty string");
			if (typeof resourceId !== "string" || !resourceId.trim()) throw new Error("[Audit] resourceId must be a non-empty string");
		}
	};
	//#endregion
	//#region ../../../core/audit/index.js
	/**
	* Singleton do módulo de auditoria.
	* Use este objeto em todos os módulos do ESA OS.
	*
	* @type {Audit}
	*/
	var audit = new Audit();
	//#endregion
	//#region ../../../core/logger/log-level.js
	/**
	* ESA OS — Core / Logger
	* LogLevel
	*
	* Catálogo de níveis de severidade para o sistema de log da plataforma ESA OS.
	* Define a escala de criticidade e os metadados de exibição de cada nível.
	*
	* Responsabilidades:
	* - Centralizar a definição dos níveis de log disponíveis
	* - Prover valor numérico para comparação de severidade
	* - Prover label e cor para formatação visual
	* - Ser a única fonte de verdade sobre níveis — nunca usar strings literais
	*
	* Escala de severidade (crescente):
	*   DEBUG (0) → INFO (1) → WARN (2) → ERROR (3) → CRITICAL (4)
	*
	* IMPORTANTE:
	* Este arquivo NÃO está conectado ao Dashboard legado (index.html).
	* Não altera nenhum comportamento da aplicação em produção.
	*/
	/**
	* Enumeração dos níveis de log disponíveis na plataforma.
	*
	* TODO: Tornar o nível mínimo de log configurável via ESA_CORE_CONFIG
	* TODO: Suportar nível OFF (desabilitar logs por completo em produção se necessário)
	*/
	var LOG_LEVEL = {
		/**
		* DEBUG (0) — Detalhes verbosos para diagnóstico em desenvolvimento.
		* Nunca deve aparecer em produção.
		* Ex: valores de variáveis intermediárias, fluxo de execução passo a passo.
		*/
		DEBUG: "DEBUG",
		/**
		* INFO (1) — Eventos normais do ciclo de vida da aplicação.
		* Ex: módulo inicializado, usuário autenticado, deal criado.
		*/
		INFO: "INFO",
		/**
		* WARN (2) — Situações inesperadas que não interrompem a operação.
		* Ex: configuração ausente com fallback aplicado, sessão próxima do vencimento.
		*/
		WARN: "WARN",
		/**
		* ERROR (3) — Falhas que afetam uma operação específica.
		* Ex: falha ao salvar deal, timeout de requisição, permissão negada.
		*/
		ERROR: "ERROR",
		/**
		* CRITICAL (4) — Falhas que comprometem a estabilidade da plataforma.
		* Ex: Event Bus não inicializado, perda de conexão com Firebase, erro fatal no boot.
		* TODO: Integrar com sistema de alertas externo (PagerDuty, Slack) quando disponível.
		*/
		CRITICAL: "CRITICAL"
	};
	/**
	* Valor numérico de cada nível para comparação de severidade.
	* Quanto maior o número, mais crítico o evento.
	*
	* Uso: LOG_LEVEL_RANK[LOG_LEVEL.ERROR] > LOG_LEVEL_RANK[LOG_LEVEL.INFO] // true
	*/
	var LOG_LEVEL_RANK = {
		[LOG_LEVEL.DEBUG]: 0,
		[LOG_LEVEL.INFO]: 1,
		[LOG_LEVEL.WARN]: 2,
		[LOG_LEVEL.ERROR]: 3,
		[LOG_LEVEL.CRITICAL]: 4
	};
	LOG_LEVEL.DEBUG, LOG_LEVEL.INFO, LOG_LEVEL.WARN, LOG_LEVEL.ERROR, LOG_LEVEL.CRITICAL;
	/**
	* Verifica se um nível é igual ou mais severo que o nível de referência.
	* @param {string} level     - Nível a verificar (LOG_LEVEL.*)
	* @param {string} threshold - Nível mínimo de referência
	* @returns {boolean}
	* @throws {Error} Se level ou threshold forem desconhecidos
	*/
	function isAtLeast(level, threshold) {
		if (LOG_LEVEL_RANK[level] === void 0) throw new Error(`[isAtLeast] Unknown log level: "${level}"`);
		if (LOG_LEVEL_RANK[threshold] === void 0) throw new Error(`[isAtLeast] Unknown threshold level: "${threshold}"`);
		return LOG_LEVEL_RANK[level] >= LOG_LEVEL_RANK[threshold];
	}
	//#endregion
	//#region ../../../core/logger/log-entry.js
	/**
	* ESA OS — Core / Logger
	* LogEntry
	*
	* Representa um registro de log imutável da plataforma ESA OS.
	* É a unidade fundamental transportada pelo sistema de log.
	*
	* Responsabilidades:
	* - Armazenar todos os dados de um evento de log em estrutura coesa
	* - Identificar a origem (source) e o nível de severidade
	* - Carregar contexto estruturado para diagnóstico e auditoria
	* - Ser serializável para persistência, transporte e formatação
	* - Ser imutável após construção — logs são fatos, não estados mutáveis
	*
	* IMPORTANTE:
	* Este arquivo NÃO está conectado ao Dashboard legado (index.html).
	* Não grava nada em console, storage ou rede. Apenas modela o dado.
	*/
	/**
	* Representa uma entrada de log imutável.
	*/
	var LogEntry = class LogEntry {
		/**
		* @param {string} level     - Severidade: LOG_LEVEL.*
		* @param {string} message   - Mensagem principal legível por humanos
		* @param {string} source    - Módulo ou classe de origem (ex: 'CRMDomain', 'EventBus')
		* @param {Object} context   - Dados estruturados relevantes ao evento
		* @param {Object} metadata  - Dados extras para rastreabilidade (correlationId, traceId, userId)
		*/
		constructor(level, message, source = "", context = {}, metadata = {}) {
			/** @type {string} Identificador único desta entrada de log */
			this.id = LogEntry._generateId();
			/** @type {string} Nível de severidade: LOG_LEVEL.* */
			this.level = level;
			/** @type {string} Mensagem descritiva do evento */
			this.message = message;
			/** @type {string} Módulo ou classe que gerou o log */
			this.source = source;
			/**
			* @type {Object} Dados estruturados adicionais.
			* TODO: Sanitizar campos sensíveis (senhas, tokens) antes de armazenar
			*/
			this.context = context;
			/**
			* @type {number} Timestamp em milissegundos desde epoch (imutável após criação).
			* Registrado no momento da construção, não do despacho.
			*/
			this.timestamp = Date.now();
			/**
			* @type {Object} Metadados de rastreamento transversal.
			* Campos sugeridos: correlationId, traceId, userId, requestId, sessionId
			*
			* TODO: Propagar correlationId entre entradas causalmente relacionadas
			*/
			this.metadata = metadata;
		}
		/**
		* Verifica se esta entrada é de um nível específico.
		* @param {string} level - LOG_LEVEL.*
		* @returns {boolean}
		*/
		isLevel(level) {
			return this.level === level;
		}
		/**
		* Verifica se esta entrada é de severidade ERROR ou CRITICAL.
		* @returns {boolean}
		*/
		isCriticalOrError() {
			return LOG_LEVEL_RANK[this.level] >= LOG_LEVEL_RANK[LOG_LEVEL.ERROR];
		}
		/**
		* Retorna a idade desta entrada em milissegundos.
		* @returns {number}
		*/
		getAgeMs() {
			return Date.now() - this.timestamp;
		}
		/**
		* Serializa a entrada para objeto plano.
		* Usado pelo LogFormatter e por integrações de persistência.
		* @returns {Object}
		*/
		toJSON() {
			return {
				id: this.id,
				level: this.level,
				message: this.message,
				source: this.source,
				context: this.context,
				timestamp: this.timestamp,
				metadata: this.metadata
			};
		}
		/**
		* Reconstrói uma LogEntry a partir de objeto serializado.
		* Preserva id e timestamp originais — não gera novos.
		* @param {Object} data
		* @returns {LogEntry}
		*/
		static fromJSON(data) {
			const entry = new LogEntry(data.level || LOG_LEVEL.INFO, data.message || "", data.source || "", data.context || {}, data.metadata || {});
			entry.id = data.id || entry.id;
			entry.timestamp = data.timestamp || entry.timestamp;
			return entry;
		}
		/**
		* Gera um identificador único para a entrada.
		* Usa crypto.randomUUID() quando disponível; fallback para ambientes sem suporte.
		* @returns {string}
		* @private
		*/
		static _generateId() {
			if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
			return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
		}
	};
	//#endregion
	//#region ../../../core/logger/formatter.js
	/** Chaves cujos valores devem ser substituídos por [REDACTED] (case-insensitive). */
	var SENSITIVE_KEYS = [
		"password",
		"pass",
		"passhash",
		"token",
		"secret",
		"apikey",
		"authorization"
	];
	/** Mapeamento de LOG_LEVEL para severity de monitoramento externo. */
	var SEVERITY_MAP = {
		CRITICAL: "fatal",
		ERROR: "error",
		WARN: "warning",
		INFO: "info",
		DEBUG: "debug"
	};
	/**
	* Formata entradas de log para diferentes destinos de saída.
	*/
	var LogFormatter = class {
		/**
		* @param {Object}  options
		* @param {boolean} options.includeTimestamp - Incluir timestamp nas saídas (padrão: true)
		* @param {boolean} options.includeSource    - Incluir source nas saídas (padrão: true)
		* @param {boolean} options.includeId        - Incluir id da entrada nas saídas (padrão: false)
		* @param {string}  options.timestampFormat  - 'iso' | 'locale' | 'ms'
		*/
		constructor(options = {}) {
			this.options = {
				includeTimestamp: true,
				includeSource: true,
				includeId: false,
				timestampFormat: "iso",
				...options
			};
		}
		/**
		* Formata uma LogEntry para exibição no console do browser/Node.
		* Formato: [LEVEL] TIMESTAMP [SOURCE] MESSAGE
		* @param {LogEntry} entry
		* @returns {string}
		*/
		formatForConsole(entry) {
			const parts = [];
			if (this.options.includeId) parts.push(`(${entry.id})`);
			parts.push(`[${entry.level}]`);
			if (this.options.includeTimestamp) parts.push(this._formatTimestamp(entry.timestamp));
			if (this.options.includeSource && entry.source) parts.push(`[${entry.source}]`);
			parts.push(entry.message);
			return parts.join(" ");
		}
		/**
		* Formata uma LogEntry para escrita em arquivo de log (linha única, sem cores).
		* Formato: TIMESTAMP | LEVEL | SOURCE | MESSAGE | CONTEXT_JSON
		* @param {LogEntry} entry
		* @returns {string}
		*/
		formatForFile(entry) {
			const ts = this._formatTimestamp(entry.timestamp);
			const msg = String(entry.message).replace(/\r?\n/g, " ");
			const ctx = this._serializeContext(entry.context);
			return `${ts} | ${entry.level} | ${entry.source || ""} | ${msg} | ${ctx}`;
		}
		/**
		* Formata uma LogEntry para registro na trilha de auditoria.
		* Retorna objeto estruturado com todos os campos relevantes para compliance.
		* @param {LogEntry} entry
		* @returns {Object}
		*/
		formatForAudit(entry) {
			return {
				id: entry.id,
				timestamp: entry.timestamp,
				level: entry.level,
				message: entry.message,
				source: entry.source,
				context: entry.context,
				metadata: entry.metadata
			};
		}
		/**
		* Prepara payload de uma LogEntry para análise pela Solana IA.
		* @param {LogEntry} entry
		* @returns {Object}
		*/
		formatForIA(entry) {
			return {
				severity: entry.level.toLowerCase(),
				message: entry.message,
				source: entry.source,
				context: entry.context,
				timestamp: entry.timestamp
			};
		}
		/**
		* Formata uma LogEntry para envio a ferramentas externas de monitoramento.
		* Estrutura compatível com formato comum (Sentry, Datadog, New Relic).
		* @param {LogEntry} entry
		* @returns {Object}
		*/
		formatForMonitoring(entry) {
			return {
				eventId: entry.id,
				level: entry.level,
				severity: SEVERITY_MAP[entry.level] || "info",
				message: entry.message,
				source: entry.source,
				timestamp: entry.timestamp,
				tags: {
					source: entry.source,
					level: entry.level
				},
				extra: entry.context
			};
		}
		/**
		* Formata o timestamp conforme options.timestampFormat.
		* Suporta: 'iso' (toISOString), 'locale' (pt-BR), 'ms' (raw ms)
		* @param {number} timestamp
		* @returns {string}
		* @private
		*/
		_formatTimestamp(timestamp) {
			const fmt = this.options.timestampFormat;
			if (fmt === "ms") return String(timestamp);
			if (fmt === "locale") return new Date(timestamp).toLocaleString("pt-BR");
			return new Date(timestamp).toISOString();
		}
		/**
		* Serializa o context de forma segura, removendo campos sensíveis.
		* Sanitização recursiva — suporta objetos e arrays aninhados.
		* Não muta o objeto original.
		* @param {Object} context
		* @returns {string} JSON string
		* @private
		*/
		_serializeContext(context) {
			if (context === null || context === void 0) return "{}";
			const sanitize = (val) => {
				if (val === null || val === void 0) return val;
				if (Array.isArray(val)) return val.map(sanitize);
				if (typeof val === "object") {
					const out = {};
					for (const [k, v] of Object.entries(val)) out[k] = SENSITIVE_KEYS.includes(k.toLowerCase()) ? "[REDACTED]" : sanitize(v);
					return out;
				}
				return val;
			};
			try {
				return JSON.stringify(sanitize(context));
			} catch {
				return "{}";
			}
		}
	};
	//#endregion
	//#region ../../../core/logger/logger.js
	/**
	* ESA OS — Core / Logger
	* Logger
	*
	* Sistema de registro centralizado da plataforma ESA OS.
	* Ponto único de entrada para produção de logs em qualquer módulo.
	*
	* Responsabilidades:
	* - Receber registros de log de qualquer Domain, Service ou Core module
	* - Criar LogEntry estruturada para cada chamada
	* - Aplicar filtro por nível mínimo configurado
	* - Manter histórico em memória (ring buffer) para diagnóstico
	* - Despachar entradas para os destinos configurados via LogFormatter
	* - Prover métodos semânticos por nível (debug, info, warn, error, critical)
	*
	* IMPORTANTE:
	* Este arquivo NÃO está conectado ao Dashboard legado (index.html).
	* Não usa localStorage, sessionStorage ou Firebase.
	* Não integrado com Event Bus nem Audit nesta fase.
	*/
	/**
	* Capacidade máxima do histórico em memória.
	* Ao atingir o limite, as entradas mais antigas são descartadas (ring buffer).
	*
	* TODO: Tornar configurável via ESA_CORE_CONFIG
	*/
	var DEFAULT_HISTORY_LIMIT = 1e3;
	/** Mapeamento de nível para método nativo do console. */
	var CONSOLE_METHOD = {
		DEBUG: "debug",
		INFO: "info",
		WARN: "warn",
		ERROR: "error",
		CRITICAL: "error"
	};
	//#endregion
	//#region ../../../core/logger/index.js
	/**
	* Instância singleton do Logger da plataforma ESA OS.
	*
	* Use esta instância diretamente ou crie instâncias filhas via logger.child().
	* Nunca instancie Logger diretamente fora dos testes.
	*
	* TODO: Configurar minLevel com base em ESA_CURRENT_ENVIRONMENT (DEBUG em dev, WARN em prod)
	* TODO: Inicializar via ESAApplication ao invés de eager instantiation
	*/
	var logger = new class Logger {
		/**
		* @param {string}       source       - Identificador do módulo dono desta instância
		* @param {string}       minLevel     - Nível mínimo a registrar: LOG_LEVEL.*
		* @param {number}       historyLimit - Máximo de entradas mantidas em memória
		* @param {LogEntry[]}   [_shared]    - Array compartilhado (uso interno de child())
		* @param {LogFormatter} [_formatter] - Formatter compartilhado (uso interno de child())
		*/
		constructor(source = "ESA OS", minLevel = LOG_LEVEL.DEBUG, historyLimit = DEFAULT_HISTORY_LIMIT, _shared = null, _formatter = null) {
			/** @type {string} Módulo de origem padrão para todas as entradas desta instância */
			this.source = source;
			/** @type {string} Nível mínimo de log */
			this.minLevel = minLevel;
			/** @type {number} */
			this.historyLimit = historyLimit;
			/**
			* @type {LogEntry[]} Histórico em memória (ring buffer).
			* Quando _shared é fornecido, pai e filho compartilham o mesmo array.
			*/
			this._entries = _shared || [];
			/** @type {LogFormatter} */
			this._formatter = _formatter || new LogFormatter();
			/**
			* @type {boolean} Controla se logs são despachados para o console.
			* TODO: Ativar por padrão apenas em ESA_ENVIRONMENTS.DEVELOPMENT
			*/
			this._consoleEnabled = false;
		}
		/**
		* Registra uma entrada DEBUG.
		* @param {string} message
		* @param {Object} context
		* @param {Object} metadata
		* @returns {LogEntry|null}
		*/
		debug(message, context = {}, metadata = {}) {
			return this.log(LOG_LEVEL.DEBUG, message, context, metadata);
		}
		/**
		* Registra uma entrada INFO.
		* @param {string} message
		* @param {Object} context
		* @param {Object} metadata
		* @returns {LogEntry|null}
		*/
		info(message, context = {}, metadata = {}) {
			return this.log(LOG_LEVEL.INFO, message, context, metadata);
		}
		/**
		* Registra uma entrada WARN.
		* @param {string} message
		* @param {Object} context
		* @param {Object} metadata
		* @returns {LogEntry|null}
		*/
		warn(message, context = {}, metadata = {}) {
			return this.log(LOG_LEVEL.WARN, message, context, metadata);
		}
		/**
		* Registra uma entrada ERROR.
		* Inclui automaticamente errorMessage, errorName e errorStack no context
		* quando error é uma instância de Error. Não muta o context original.
		*
		* @param {string}     message
		* @param {Error|null} error
		* @param {Object}     context
		* @param {Object}     metadata
		* @returns {LogEntry|null}
		*/
		error(message, error = null, context = {}, metadata = {}) {
			const ctx = error instanceof Error ? {
				...context,
				errorMessage: error.message,
				errorName: error.name,
				errorStack: error.stack
			} : context;
			return this.log(LOG_LEVEL.ERROR, message, ctx, metadata);
		}
		/**
		* Registra uma entrada CRITICAL.
		* Inclui automaticamente errorMessage, errorName e errorStack no context
		* quando error é uma instância de Error. Não muta o context original.
		*
		* @param {string}     message
		* @param {Error|null} error
		* @param {Object}     context
		* @param {Object}     metadata
		* @returns {LogEntry|null}
		*/
		critical(message, error = null, context = {}, metadata = {}) {
			const ctx = error instanceof Error ? {
				...context,
				errorMessage: error.message,
				errorName: error.name,
				errorStack: error.stack
			} : context;
			return this.log(LOG_LEVEL.CRITICAL, message, ctx, metadata);
		}
		/**
		* Método base de registro. Todos os métodos semânticos delegam para cá.
		*
		* @param {string} level    - LOG_LEVEL.*
		* @param {string} message
		* @param {Object} context
		* @param {Object} metadata
		* @returns {LogEntry|null} - A entrada criada, ou null se filtrada pelo minLevel
		*/
		log(level, message, context = {}, metadata = {}) {
			if (LOG_LEVEL_RANK[level] === void 0) throw new Error(`[Logger] Unknown log level: "${level}"`);
			if (message === null || message === void 0) throw new Error("[Logger] message must not be null or undefined");
			if (!isAtLeast(level, this.minLevel)) return null;
			const entry = new LogEntry(level, String(message), this.source, context, metadata);
			this._entries.push(entry);
			if (this._entries.length > this.historyLimit) this._entries.shift();
			if (this._consoleEnabled) {
				const formatted = this._formatter.formatForConsole(entry);
				const method = CONSOLE_METHOD[level] || "log";
				console[method](formatted);
			}
			return entry;
		}
		/**
		* Retorna as entradas do histórico em memória.
		* Ordenadas por timestamp DESC (mais recente primeiro).
		* Retorna cópia — não expõe o array interno.
		*
		* @param {string} [level] - Filtro opcional por nível (LOG_LEVEL.*)
		* @param {number} [limit] - Máximo de entradas (0 = sem limite)
		* @returns {LogEntry[]}
		*/
		getEntries(level = "", limit = 0) {
			let result = this._entries.slice().reverse();
			if (level) result = result.filter((e) => e.level === level);
			if (limit > 0) result = result.slice(0, limit);
			return result;
		}
		/**
		* Retorna somente entradas ERROR e CRITICAL, ordenadas por timestamp DESC.
		* @returns {LogEntry[]}
		*/
		getErrors() {
			return this._entries.slice().reverse().filter((e) => e.level === LOG_LEVEL.ERROR || e.level === LOG_LEVEL.CRITICAL);
		}
		/**
		* Limpa o histórico em memória.
		* Não registra novo log durante a limpeza.
		*/
		clear() {
			this._entries.length = 0;
		}
		/**
		* Define o nível mínimo de log desta instância.
		* @param {string} level - LOG_LEVEL.*
		*/
		setMinLevel(level) {
			if (LOG_LEVEL_RANK[level] === void 0) throw new Error(`[Logger] Unknown log level: "${level}"`);
			this.minLevel = level;
		}
		/**
		* Ativa ou desativa a saída no console.
		* @param {boolean} enabled
		*/
		setConsoleEnabled(enabled) {
			this._consoleEnabled = Boolean(enabled);
		}
		/**
		* Cria um Logger filho com source diferente.
		* O filho herda minLevel, historyLimit, formatter e _consoleEnabled.
		* Compartilha o mesmo array de histórico — logs do filho aparecem em
		* parent.getEntries() e vice-versa.
		*
		* @param {string} childSource
		* @returns {Logger}
		*/
		child(childSource) {
			const c = new Logger(childSource, this.minLevel, this.historyLimit, this._entries, this._formatter);
			c._consoleEnabled = this._consoleEnabled;
			return c;
		}
		/**
		* Retorna snapshot de diagnóstico desta instância do Logger.
		* @returns {{ source, minLevel, entryCount, historyLimit, consoleEnabled, errorCount, criticalCount }}
		*/
		getStats() {
			const errorCount = this._entries.filter((e) => e.level === LOG_LEVEL.ERROR).length;
			const criticalCount = this._entries.filter((e) => e.level === LOG_LEVEL.CRITICAL).length;
			return {
				source: this.source,
				minLevel: this.minLevel,
				entryCount: this._entries.length,
				historyLimit: this.historyLimit,
				consoleEnabled: this._consoleEnabled,
				errorCount,
				criticalCount
			};
		}
	}("ESA OS", LOG_LEVEL.DEBUG);
	//#endregion
	//#region ../../../integrations/crm-event-mapper.js
	/**
	* ESA OS — Integrations
	* CRMEventMapper
	*
	* Converte CoreEvents do domínio CRM em comandos de auditoria.
	* Atua como camada de tradução entre o vocabulário do Event Bus
	* e o vocabulário do módulo de Audit.
	*
	* Responsabilidades:
	* - Mapear tipo de evento CRM → AUDIT_ACTION
	* - Inferir resource e resourceId a partir do payload
	* - Extrair before/after relevantes para cada tipo de evento
	* - Construir metadata canônico para rastreabilidade
	*
	* Retorna null quando:
	* - O tipo de evento não é reconhecido
	* - Nenhum resourceId pode ser extraído do payload
	*
	* IMPORTANTE:
	* Este arquivo NÃO está conectado ao Dashboard legado (index.html).
	* Não integra com Logger. Não integra com Firebase.
	*/
	/**
	* Tabela de mapeamento: tipo de evento → { action, resource }
	*/
	var EVENT_MAP = {
		"crm:deal:created": {
			action: AUDIT_ACTION.CREATE,
			resource: "deal"
		},
		"crm:deal:updated": {
			action: AUDIT_ACTION.UPDATE,
			resource: "deal"
		},
		"crm:deal:stage-changed": {
			action: AUDIT_ACTION.MOVE,
			resource: "deal"
		},
		"crm:deal:won": {
			action: AUDIT_ACTION.APPROVE,
			resource: "deal"
		},
		"crm:deal:lost": {
			action: AUDIT_ACTION.REJECT,
			resource: "deal"
		},
		"crm:deal:paused": {
			action: AUDIT_ACTION.UPDATE,
			resource: "deal"
		},
		"crm:followup:added": {
			action: AUDIT_ACTION.CREATE,
			resource: "followup"
		},
		"crm:activity:completed": {
			action: AUDIT_ACTION.EXECUTE,
			resource: "activity"
		},
		"crm:proposal:sent": {
			action: AUDIT_ACTION.EXECUTE,
			resource: "proposal"
		},
		"crm:proposal:accepted": {
			action: AUDIT_ACTION.APPROVE,
			resource: "proposal"
		}
	};
	/**
	* Converte CoreEvents CRM em descritores de auditoria.
	*/
	var CRMEventMapper = class {
		/**
		* Mapeia um CoreEvent para um descritor de auditoria.
		*
		* @param {CoreEvent} event
		* @returns {{ action, resource, resourceId, before, after, metadata } | null}
		*   null quando o evento não é mapeável ou não possui resourceId identificável.
		*/
		map(event) {
			const mapping = EVENT_MAP[event.type];
			if (!mapping) return null;
			const payload = event.payload || {};
			const resourceId = this._extractResourceId(payload);
			if (resourceId === null) return null;
			const { before, after } = this._extractBeforeAfter(event.type, payload);
			const metadata = this._buildMetadata(event);
			return {
				action: mapping.action,
				resource: mapping.resource,
				resourceId,
				before,
				after,
				metadata
			};
		}
		/**
		* Extrai o resourceId do payload na ordem de prioridade definida.
		* Retorna null se nenhum dos campos estiver presente.
		* @private
		*/
		_extractResourceId(payload) {
			if (payload.id != null) return String(payload.id);
			if (payload.dealId != null) return String(payload.dealId);
			if (payload.followupId != null) return String(payload.followupId);
			if (payload.activityId != null) return String(payload.activityId);
			if (payload.proposalId != null) return String(payload.proposalId);
			return null;
		}
		/**
		* Extrai before e after conforme a semântica de cada tipo de evento.
		* Não muta o payload original.
		* @private
		*/
		_extractBeforeAfter(type, payload) {
			switch (type) {
				case "crm:deal:created": return {
					before: null,
					after: payload.deal || payload
				};
				case "crm:deal:updated": return {
					before: payload.before || null,
					after: payload.after || payload.deal || null
				};
				case "crm:deal:stage-changed": return {
					before: { stage: payload.fromStage },
					after: { stage: payload.toStage }
				};
				case "crm:deal:won":
				case "crm:deal:lost":
				case "crm:deal:paused": return {
					before: payload.before || null,
					after: payload.after || payload.deal || payload
				};
				default: return {
					before: null,
					after: payload
				};
			}
		}
		/**
		* Constrói o metadata canônico para a AuditEntry.
		* Campos canônicos prevalecem sobre os campos de event.metadata em caso de conflito.
		* Não muta event.metadata.
		* @private
		*/
		_buildMetadata(event) {
			const sourceMeta = event.metadata || {};
			return {
				...sourceMeta,
				eventId: event.id,
				eventType: event.type,
				eventSource: event.source,
				eventCreatedAt: event.createdAt,
				correlationId: sourceMeta.correlationId || ""
			};
		}
	};
	//#endregion
	//#region ../../../integrations/crm-audit-integration.js
	/**
	* ESA OS — Integrations
	* CRMAuditIntegration
	*
	* Escuta eventos do domínio CRM no Event Bus e gera AuditEntries
	* correspondentes no módulo de Audit.
	*
	* Responsabilidades:
	* - Assinar o wildcard 'crm:*' no Event Bus após start()
	* - Usar CRMEventMapper para converter cada evento em um comando de auditoria
	* - Construir AuditContext a partir dos metadados do evento
	* - Chamar audit.record() quando o contexto for válido
	* - Manter contadores de diagnóstico para observabilidade
	* - Registrar cada path (sucesso/skip/erro) via Logger opcional
	* - Isolar erros internamente — nunca relançar para o Event Bus
	*
	* Padrão: Integration / Adapter
	* Instanciação: via dependency injection (não importa singletons)
	*
	* IMPORTANTE:
	* Este arquivo NÃO está conectado ao Dashboard legado (index.html).
	* Não integra com Firebase.
	*/
	/** Owner registrado no Subscriber do Event Bus para diagnóstico. */
	var SUBSCRIBER_OWNER$1 = "CRMAuditIntegration";
	/**
	* Integração CRM → Audit via Event Bus.
	* Logger é opcional — a integração funciona normalmente sem ele.
	*/
	var CRMAuditIntegration = class {
		/**
		* @param {EventBus}    eventBus       - Instância do EventBus da ESA OS (injetada)
		* @param {Audit}       audit          - Instância do Audit da ESA OS (injetada)
		* @param {Logger|null} [logger=null]  - Logger opcional para observabilidade (injetado)
		*/
		constructor(eventBus, audit, logger = null) {
			this._eventBus = eventBus;
			this._audit = audit;
			this._mapper = new CRMEventMapper();
			if (logger !== null) this._logger = typeof logger.child === "function" ? logger.child(SUBSCRIBER_OWNER$1) : logger;
			else this._logger = null;
			this._started = false;
			this._subscriberId = null;
			this._receivedCount = 0;
			this._auditedCount = 0;
			this._skippedUnmapped = 0;
			this._skippedInvalidContext = 0;
			this._errorCount = 0;
			this._lastError = null;
		}
		/**
		* Inicia a integração assinando 'crm:*' no Event Bus.
		* Idempotente — chamadas adicionais quando já iniciado não têm efeito.
		* @throws {TypeError} Se eventBus ou audit não expuserem os métodos necessários
		*/
		start() {
			if (this._started) return;
			if (!this._eventBus || typeof this._eventBus.subscribe !== "function") throw new TypeError("[CRMAuditIntegration] eventBus must expose subscribe()");
			if (!this._audit || typeof this._audit.record !== "function") throw new TypeError("[CRMAuditIntegration] audit must expose record()");
			this._subscriberId = this._eventBus.subscribe("crm:*", async (event) => this._handleEvent(event), { owner: SUBSCRIBER_OWNER$1 });
			this._started = true;
		}
		/**
		* Para a integração removendo a assinatura do Event Bus.
		* @returns {boolean} false se já estava parado; resultado de unsubscribe() caso contrário
		*/
		stop() {
			if (!this._started) return false;
			const result = this._eventBus.unsubscribe(this._subscriberId);
			this._subscriberId = null;
			this._started = false;
			return result;
		}
		/**
		* Indica se a integração está ativa.
		* @returns {boolean}
		*/
		isStarted() {
			return this._started;
		}
		/**
		* Retorna snapshot de diagnóstico desta integração.
		* @returns {Object}
		*/
		getStats() {
			return {
				started: this._started,
				subscriberId: this._subscriberId,
				receivedCount: this._receivedCount,
				auditedCount: this._auditedCount,
				skippedUnmapped: this._skippedUnmapped,
				skippedInvalidContext: this._skippedInvalidContext,
				errorCount: this._errorCount,
				lastError: this._lastError,
				loggerEnabled: this._logger !== null
			};
		}
		/**
		* Handler async invocado pelo Event Bus para cada evento 'crm:*'.
		* Nunca relança erros — isola falhas internas.
		* @private
		*/
		async _handleEvent(event) {
			this._receivedCount++;
			try {
				const mapped = this._mapper.map(event);
				if (mapped === null) {
					this._skippedUnmapped++;
					if (this._logger) this._logger.debug("CRM audit skipped: unmapped event", {
						eventId: event.id,
						eventType: event.type
					});
					return;
				}
				const context = this._buildContext(event);
				if (!context.isValid()) {
					this._skippedInvalidContext++;
					if (this._logger) this._logger.warn("CRM audit skipped: invalid context", {
						eventId: event.id,
						eventType: event.type,
						organizationId: context.organizationId,
						personId: context.personId
					});
					return;
				}
				const auditEntry = this._audit.record(context, mapped.action, mapped.resource, mapped.resourceId, mapped.before, mapped.after, mapped.metadata);
				this._auditedCount++;
				if (this._logger) this._logger.info("CRM event audited", {
					eventId: event.id,
					eventType: event.type,
					auditEntryId: auditEntry.id,
					action: mapped.action,
					resource: mapped.resource,
					resourceId: mapped.resourceId
				});
			} catch (err) {
				this._errorCount++;
				this._lastError = {
					name: err.name || "Error",
					message: err.message || String(err)
				};
				if (this._logger) this._logger.error("CRM audit integration failed", err, {
					eventId: event.id,
					eventType: event.type
				});
			}
		}
		/**
		* Constrói um AuditContext a partir dos metadados e payload do evento.
		* Não acessa browser, navigator ou IP real.
		* @private
		*/
		_buildContext(event) {
			const meta = event.metadata || {};
			const payload = event.payload || {};
			return new AuditContext(meta.organizationId || payload.organizationId || "", meta.personId || meta.userId || payload.personId || payload.userId || "", meta.sessionId || "", event.source || "CRM", "", "", meta.correlationId || "");
		}
	};
	//#endregion
	//#region ../../../integrations/integration-registry.js
	/**
	* ESA OS — Integrations
	* IntegrationRegistry
	*
	* Registro central das integrações ativas da plataforma ESA OS.
	* Controla o ciclo de vida de cada integração de forma uniforme.
	*
	* Responsabilidades:
	* - Manter um catálogo nomeado de integrações registradas
	* - Controlar start/stop individual ou em massa
	* - Prover listagem e estatísticas de diagnóstico
	* - Garantir que nomes duplicados não sejam registrados
	* - Parar automaticamente integrações ativas ao removê-las
	*
	* Interface mínima esperada de uma integração:
	*   start()
	*   stop()
	*   isStarted() → boolean
	*
	* IMPORTANTE:
	* Este arquivo NÃO está conectado ao Dashboard legado (index.html).
	* Não integra com Logger. Não integra com Firebase.
	*/
	/**
	* Registro de integrações da plataforma ESA OS.
	*/
	var IntegrationRegistry = class {
		constructor() {
			/** @type {Map<string, Object>} */
			this._integrations = /* @__PURE__ */ new Map();
		}
		/**
		* Registra uma integração com nome único.
		* @param {string} name        - Identificador único (ex: 'crmAudit')
		* @param {Object} integration - Objeto que expõe start(), stop(), isStarted()
		* @returns {Object} A integração registrada
		* @throws {Error}     Se o nome já estiver em uso
		* @throws {TypeError} Se o nome for inválido ou a integração não expuser a interface mínima
		*/
		register(name, integration) {
			if (typeof name !== "string" || !name.trim()) throw new TypeError("[IntegrationRegistry] name must be a non-empty string");
			if (!integration || typeof integration.start !== "function" || typeof integration.stop !== "function" || typeof integration.isStarted !== "function") throw new TypeError("[IntegrationRegistry] integration must expose start(), stop(), isStarted()");
			if (this._integrations.has(name)) throw new Error(`[IntegrationRegistry] Integration "${name}" is already registered`);
			this._integrations.set(name, integration);
			return integration;
		}
		/**
		* Remove uma integração pelo nome.
		* Se estiver iniciada, chama stop() antes de remover.
		* @param {string} name
		* @returns {boolean} true se existia e foi removida, false se não existia
		*/
		unregister(name) {
			const integration = this._integrations.get(name);
			if (!integration) return false;
			if (integration.isStarted()) integration.stop();
			this._integrations.delete(name);
			return true;
		}
		/**
		* Retorna a integração pelo nome, ou null se não existir.
		* @param {string} name
		* @returns {Object|null}
		*/
		get(name) {
			return this._integrations.get(name) || null;
		}
		/**
		* Inicia uma integração pelo nome.
		* @param {string} name
		* @throws {Error} Se o nome não estiver registrado
		*/
		start(name) {
			const integration = this._integrations.get(name);
			if (!integration) throw new Error(`[IntegrationRegistry] Unknown integration: "${name}"`);
			return integration.start();
		}
		/**
		* Para uma integração pelo nome.
		* @param {string} name
		* @throws {Error} Se o nome não estiver registrado
		*/
		stop(name) {
			const integration = this._integrations.get(name);
			if (!integration) throw new Error(`[IntegrationRegistry] Unknown integration: "${name}"`);
			return integration.stop();
		}
		/**
		* Inicia todas as integrações registradas, sequencialmente.
		* Registra falhas sem interromper o restante.
		* @returns {{ started: string[], failed: Array<{ name, error }> }}
		*/
		startAll() {
			const started = [];
			const failed = [];
			for (const [name, integration] of this._integrations) try {
				integration.start();
				started.push(name);
			} catch (err) {
				failed.push({
					name,
					error: err.message || String(err)
				});
			}
			return {
				started,
				failed
			};
		}
		/**
		* Para todas as integrações registradas, sequencialmente.
		* Registra falhas sem interromper o restante.
		* @returns {{ stopped: string[], failed: Array<{ name, error }> }}
		*/
		stopAll() {
			const stopped = [];
			const failed = [];
			for (const [name, integration] of this._integrations) try {
				integration.stop();
				stopped.push(name);
			} catch (err) {
				failed.push({
					name,
					error: err.message || String(err)
				});
			}
			return {
				stopped,
				failed
			};
		}
		/**
		* Lista as integrações registradas com seus estados.
		* Retorna cópia — não expõe o Map interno.
		* @returns {Array<{ name: string, started: boolean }>}
		*/
		list() {
			return Array.from(this._integrations.entries()).map(([name, integration]) => ({
				name,
				started: integration.isStarted()
			}));
		}
		/**
		* Retorna estatísticas de todas as integrações registradas.
		* Usa integration.getStats() quando disponível.
		* @returns {Object}
		*/
		getStats() {
			const stats = {};
			for (const [name, integration] of this._integrations) stats[name] = typeof integration.getStats === "function" ? integration.getStats() : { started: integration.isStarted() };
			return stats;
		}
	};
	//#endregion
	//#region ../../../integrations/index.js
	/**
	* Singleton do registro de integrações da plataforma ESA OS.
	* Use este objeto para registrar e controlar integrações em toda a plataforma.
	*
	* Integrações NÃO são pré-registradas aqui — o bootstrap de cada módulo
	* registra as integrações que precisa após inicializar suas dependências.
	*
	* @type {IntegrationRegistry}
	*/
	var integrationRegistry = new IntegrationRegistry();
	//#endregion
	//#region ../../../legacy/crm-event-bridge.js
	/**
	* ESA OS — Legacy Bridge
	* CRMLegacyEventBridge
	*
	* Traduz chamadas do CRM legado (index.html) para CoreEvents da ESA OS.
	* Permite que o código legado alimente o Event Bus sem acoplamento direto.
	*
	* Responsabilidades:
	* - Validar os dados recebidos do CRM legado antes de publicar
	* - Criar o CoreEvent com o vocabulário canônico da ESA OS
	* - Publicar no Event Bus via dependency injection
	* - Não acessar Firebase, Audit, CRMAuditIntegration ou globais do index.html
	*
	* Padrão: Adapter / Bridge
	* Instanciação: via ESAApplication.initialize() com injeção de eventBus
	* Exposição: window.ESA_OS.crmLegacyBridge
	*
	* IMPORTANTE:
	* Este arquivo NÃO tem acesso direto ao Dashboard legado.
	* Uma falha aqui nunca deve interromper a operação do CRM legado.
	*/
	/**
	* Bridge entre o CRM legado e o Event Bus da ESA OS.
	*/
	var CRMLegacyEventBridge = class {
		/**
		* @param {EventBus} eventBus - Instância do EventBus da ESA OS (injetada)
		*/
		constructor(eventBus) {
			this._eventBus = eventBus;
		}
		/**
		* Publica um evento de mudança de etapa de Deal no Event Bus.
		*
		* Só publica quando fromStage !== toStage.
		* O evento é publicado APÓS o save do Firebase ter sido confirmado pelo chamador.
		*
		* @param {Object} data
		* @param {string} data.dealId         - ID do deal movido (obrigatório, não vazio)
		* @param {string} data.fromStage      - Etapa de origem
		* @param {string} data.toStage        - Etapa de destino
		* @param {Object} [data.deal]         - Snapshot atualizado do deal
		* @param {string} [data.organizationId]
		* @param {string} [data.personId]
		* @param {string} [data.userId]
		* @param {string} [data.sessionId]
		* @param {string} [data.userName]
		* @param {string} [data.userLevel]
		* @param {string} [data.funil]
		* @returns {Promise<CoreEvent|null>} O evento publicado, ou null se fromStage === toStage
		* @throws {Error} Se dealId for inválido
		*/
		async publishStageChanged(data) {
			const { dealId, fromStage, toStage, deal = null, funil = "" } = data || {};
			if (typeof dealId !== "string" || !dealId.trim()) throw new Error("[CRMLegacyEventBridge] dealId must be a non-empty string");
			if (typeof fromStage !== "string") throw new Error("[CRMLegacyEventBridge] fromStage must be a string");
			if (typeof toStage !== "string") throw new Error("[CRMLegacyEventBridge] toStage must be a string");
			if (fromStage === toStage) return null;
			const event = new CoreEvent("crm:deal:stage-changed", {
				id: dealId,
				dealId,
				fromStage,
				toStage,
				deal,
				funil
			}, "LegacyCRM", this._buildLegacyMetadata(data));
			await this._eventBus.publish(event);
			return event;
		}
		/**
		* Publica um evento de criação de Deal no Event Bus.
		* Deve ser chamado APÓS o save do Firebase ter sido confirmado.
		*
		* @param {Object} data
		* @param {string} data.dealId         - ID do deal criado (obrigatório, não vazio)
		* @param {Object} [data.deal]         - Snapshot completo do deal salvo
		* @param {string} [data.funil]
		* @param {string} [data.organizationId]
		* @param {string} [data.personId]
		* @param {string} [data.userId]
		* @param {string} [data.sessionId]
		* @param {string} [data.userName]
		* @param {string} [data.userLevel]
		* @returns {Promise<CoreEvent>}
		* @throws {Error} Se dealId for inválido
		*/
		async publishDealCreated(data) {
			const { dealId, deal = null, funil = "" } = data || {};
			if (typeof dealId !== "string" || !dealId.trim()) throw new Error("[CRMLegacyEventBridge] dealId must be a non-empty string");
			const event = new CoreEvent("crm:deal:created", {
				id: dealId,
				dealId,
				deal,
				funil
			}, "LegacyCRM", this._buildLegacyMetadata(data));
			await this._eventBus.publish(event);
			return event;
		}
		/**
		* Publica um evento de atualização de Deal no Event Bus.
		* Deve ser chamado APÓS o save do Firebase ter sido confirmado.
		* O diff é responsabilidade de AuditEntry.getDiff() — não calcular aqui.
		*
		* @param {Object} data
		* @param {string} data.dealId         - ID do deal atualizado (obrigatório, não vazio)
		* @param {Object} [data.before]       - Snapshot do deal ANTES da edição (capturado pelo chamador)
		* @param {Object} [data.after]        - Snapshot do deal APÓS a edição
		* @param {string} [data.funil]
		* @param {string} [data.organizationId]
		* @param {string} [data.personId]
		* @param {string} [data.userId]
		* @param {string} [data.sessionId]
		* @param {string} [data.userName]
		* @param {string} [data.userLevel]
		* @returns {Promise<CoreEvent>}
		* @throws {Error} Se dealId for inválido
		*/
		async publishDealUpdated(data) {
			const { dealId, before = null, after = null, funil = "" } = data || {};
			if (typeof dealId !== "string" || !dealId.trim()) throw new Error("[CRMLegacyEventBridge] dealId must be a non-empty string");
			const event = new CoreEvent("crm:deal:updated", {
				id: dealId,
				dealId,
				before,
				after,
				deal: after,
				funil
			}, "LegacyCRM", this._buildLegacyMetadata(data));
			await this._eventBus.publish(event);
			return event;
		}
		/**
		* Publica um evento de adição de Follow-up no Event Bus.
		* Deve ser chamado APÓS o save do Firebase ter sido confirmado.
		*
		* @param {Object} data
		* @param {string} data.followupId     - ID do follow-up criado (obrigatório, não vazio)
		* @param {string} [data.dealId]       - ID do deal ao qual o follow-up pertence
		* @param {Object} [data.followup]     - Dados do follow-up salvo
		* @param {string} [data.funil]
		* @param {string} [data.organizationId]
		* @param {string} [data.personId]
		* @param {string} [data.userId]
		* @param {string} [data.sessionId]
		* @param {string} [data.userName]
		* @param {string} [data.userLevel]
		* @returns {Promise<CoreEvent>}
		* @throws {Error} Se followupId for inválido
		*/
		async publishFollowUpAdded(data) {
			const { followupId, dealId = "", followup = null, funil = "" } = data || {};
			if (typeof followupId !== "string" || !followupId.trim()) throw new Error("[CRMLegacyEventBridge] followupId must be a non-empty string");
			const event = new CoreEvent("crm:followup:added", {
				id: followupId,
				followupId,
				dealId,
				followup,
				funil
			}, "LegacyCRM", this._buildLegacyMetadata(data));
			await this._eventBus.publish(event);
			return event;
		}
		/**
		* Publica crm:deal:won quando um deal muda para status "Vendido".
		* Usar SOMENTE para essa transição — não publicar crm:deal:updated adicionalmente.
		*
		* @param {Object} data
		* @param {string} data.dealId
		* @param {Object} [data.before]
		* @param {Object} [data.after]
		* @param {string} [data.funil]
		* @param {string} [data.organizationId]
		* @param {string} [data.personId]
		* @param {string} [data.userId]
		* @param {string} [data.sessionId]
		* @param {string} [data.userName]
		* @param {string} [data.userLevel]
		* @returns {Promise<CoreEvent>}
		* @throws {Error} Se dealId for inválido
		*/
		async publishDealWon(data) {
			const { dealId, before = null, after = null, funil = "" } = data || {};
			if (typeof dealId !== "string" || !dealId.trim()) throw new Error("[CRMLegacyEventBridge] dealId must be a non-empty string");
			const event = new CoreEvent("crm:deal:won", {
				id: dealId,
				dealId,
				before,
				after,
				deal: after,
				funil
			}, "LegacyCRM", this._buildLegacyMetadata(data));
			await this._eventBus.publish(event);
			return event;
		}
		/**
		* Publica crm:deal:lost quando um deal muda para status "Perdido".
		* Usar SOMENTE para essa transição — não publicar crm:deal:updated adicionalmente.
		*
		* @param {Object} data
		* @param {string} data.dealId
		* @param {Object} [data.before]
		* @param {Object} [data.after]
		* @param {string} [data.funil]
		* @param {string} [data.organizationId]
		* @param {string} [data.personId]
		* @param {string} [data.userId]
		* @param {string} [data.sessionId]
		* @param {string} [data.userName]
		* @param {string} [data.userLevel]
		* @returns {Promise<CoreEvent>}
		* @throws {Error} Se dealId for inválido
		*/
		async publishDealLost(data) {
			const { dealId, before = null, after = null, funil = "" } = data || {};
			if (typeof dealId !== "string" || !dealId.trim()) throw new Error("[CRMLegacyEventBridge] dealId must be a non-empty string");
			const event = new CoreEvent("crm:deal:lost", {
				id: dealId,
				dealId,
				before,
				after,
				deal: after,
				funil
			}, "LegacyCRM", this._buildLegacyMetadata(data));
			await this._eventBus.publish(event);
			return event;
		}
		/**
		* Publica crm:deal:paused quando um deal muda para status "Pausado".
		* Usar SOMENTE para essa transição — não publicar crm:deal:updated adicionalmente.
		*
		* @param {Object} data
		* @param {string} data.dealId
		* @param {Object} [data.before]
		* @param {Object} [data.after]
		* @param {string} [data.funil]
		* @param {string} [data.organizationId]
		* @param {string} [data.personId]
		* @param {string} [data.userId]
		* @param {string} [data.sessionId]
		* @param {string} [data.userName]
		* @param {string} [data.userLevel]
		* @returns {Promise<CoreEvent>}
		* @throws {Error} Se dealId for inválido
		*/
		async publishDealPaused(data) {
			const { dealId, before = null, after = null, funil = "" } = data || {};
			if (typeof dealId !== "string" || !dealId.trim()) throw new Error("[CRMLegacyEventBridge] dealId must be a non-empty string");
			const event = new CoreEvent("crm:deal:paused", {
				id: dealId,
				dealId,
				before,
				after,
				deal: after,
				funil
			}, "LegacyCRM", this._buildLegacyMetadata(data));
			await this._eventBus.publish(event);
			return event;
		}
		/**
		* Constrói os metadata canônicos de um evento legado.
		* Todos os campos do usuário são opcionais e defaultam para ''.
		* @param {Object} data - Objeto de dados do chamador
		* @returns {Object}
		* @private
		*/
		_buildLegacyMetadata(data) {
			const d = data || {};
			return {
				organizationId: d.organizationId || "",
				personId: d.personId || "",
				userId: d.userId || "",
				sessionId: d.sessionId || "",
				userName: d.userName || "",
				userLevel: d.userLevel || "",
				legacy: true
			};
		}
	};
	//#endregion
	//#region ../../../legacy/crm-read-model-hydrator.js
	/**
	* ESA OS — Legacy
	* CRMLegacyReadModelHydrator
	*
	* Adapter entre o snapshot legado (crmDeals) e o CRMReadModel da ESA OS.
	* Responsável exclusivamente por delegar a hidratação inicial ao Read Model,
	* com logging observacional e isolamento de erros.
	*
	* IMPORTANTE:
	* Não importa EventBus. Não importa Audit. Não publica CoreEvents.
	* Não gera AuditEntries. Não simula crm:deal:created.
	* A hidratação é uma sincronização direta snapshot → readModel.
	*/
	var CHILD_SOURCE = "CRMLegacyReadModelHydrator";
	/**
	* Adapter para hidratação inicial do CRMReadModel a partir do snapshot legado.
	*/
	var CRMLegacyReadModelHydrator = class {
		/**
		* @param {CRMReadModel} readModel - Read Model alvo (injetado)
		* @param {Logger|null}  [logger=null] - Logger opcional (injetado)
		*/
		constructor(readModel, logger = null) {
			this._readModel = readModel;
			this._logger = logger !== null && typeof logger.child === "function" ? logger.child(CHILD_SOURCE) : logger;
		}
		/**
		* Hidrata o CRMReadModel com o snapshot legado de deals.
		* Em caso de erro: loga (se logger disponível) e relança — nunca engole.
		*
		* @param {Object|Map} deals   - Snapshot legado (crmDeals do index.html)
		* @param {Object}     options - Opções passadas diretamente ao readModel.hydrate()
		* @returns {Promise<{ received: number, hydrated: number, skipped: number, replaced: boolean }>}
		*/
		async hydrate(deals, options = {}) {
			try {
				const result = this._readModel.hydrate(deals, options);
				if (this._logger) this._logger.info("CRM read model hydrated", {
					received: result.received,
					hydrated: result.hydrated,
					skipped: result.skipped,
					replaced: result.replaced
				});
				return result;
			} catch (err) {
				if (this._logger) this._logger.error("CRM read model hydration failed", err, {});
				throw err;
			}
		}
		/**
		* Snapshot de diagnóstico do hydrator.
		* @returns {{ loggerEnabled: boolean, readModel: Object }}
		*/
		getStats() {
			return {
				loggerEnabled: this._logger !== null,
				readModel: this._readModel.getStats()
			};
		}
	};
	//#endregion
	//#region ../../../read-models/crm/crm-read-model.js
	/**
	* Projeção em memória dos Deals CRM derivada de eventos.
	*/
	var CRMReadModel = class {
		constructor() {
			/** @type {Map<string, Object>} dealId → snapshot derivado */
			this._deals = /* @__PURE__ */ new Map();
			this._hydrationCount = 0;
			this._lastHydration = null;
		}
		/**
		* Aplica um CoreEvent ao estado interno do Read Model.
		* Eventos não suportados retornam false sem lançar erro.
		*
		* @param {CoreEvent} event
		* @returns {boolean} true se o evento foi aplicado; false se ignorado
		*/
		apply(event) {
			const { type, payload = {}, createdAt, id } = event;
			switch (type) {
				case "crm:deal:created": return this._applyCreated(payload, createdAt, id, type);
				case "crm:deal:updated": return this._applyUpdated(payload, createdAt, id, type);
				case "crm:deal:stage-changed": return this._applyStageChanged(payload, createdAt, id, type);
				case "crm:deal:won": return this._applyStatus(payload, createdAt, id, type, "Vendido");
				case "crm:deal:lost": return this._applyStatus(payload, createdAt, id, type, "Perdido");
				case "crm:deal:paused": return this._applyStatus(payload, createdAt, id, type, "Pausado");
				default: return false;
			}
		}
		/**
		* Retorna cópia rasa de um Deal pelo ID.
		* @param {string} dealId
		* @returns {Object|null}
		*/
		getDeal(dealId) {
			const deal = this._deals.get(dealId);
			return deal ? Object.assign({}, deal) : null;
		}
		/**
		* Retorna array de cópias dos Deals, com filtros opcionais e ordenação por updatedAt DESC.
		*
		* @param {Object} filters
		* @param {string} [filters.funil]
		* @param {string} [filters.etapa]
		* @param {string} [filters.status]
		* @param {string} [filters.responsavel]
		* @param {string} [filters.responsavelUid]
		* @param {string} [filters.captador]
		* @param {string} [filters.captadorUid]
		* @param {number} [filters.from]  - timestamp inclusivo (updatedAt >=)
		* @param {number} [filters.to]    - timestamp inclusivo (updatedAt <=)
		* @returns {Object[]}
		*/
		getDeals(filters = {}) {
			let deals = Array.from(this._deals.values()).map((d) => Object.assign({}, d));
			if (filters.funil != null) deals = deals.filter((d) => d.funil === filters.funil);
			if (filters.etapa != null) deals = deals.filter((d) => d.etapa === filters.etapa);
			if (filters.status != null) deals = deals.filter((d) => d.status === filters.status);
			if (filters.responsavel != null) deals = deals.filter((d) => d.responsavel === filters.responsavel);
			if (filters.responsavelUid != null) deals = deals.filter((d) => d.responsavelUid === filters.responsavelUid);
			if (filters.captador != null) deals = deals.filter((d) => d.captador === filters.captador);
			if (filters.captadorUid != null) deals = deals.filter((d) => d.captadorUid === filters.captadorUid);
			if (filters.from != null) deals = deals.filter((d) => d.updatedAt >= filters.from);
			if (filters.to != null) deals = deals.filter((d) => d.updatedAt <= filters.to);
			deals.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
			return deals;
		}
		/**
		* Agrupa Deals por funil → etapa com contagens e totais.
		*
		* @param {Object} filters - Mesmos filtros de getDeals()
		* @returns {Object} { funil: { etapa: { count, totalValue, totalKwh } } }
		*/
		getPipeline(filters = {}) {
			const deals = this.getDeals(filters).filter((d) => d.funil);
			const pipeline = {};
			for (const deal of deals) {
				const funil = deal.funil;
				const etapa = deal.etapa || "Sem etapa";
				if (!pipeline[funil]) pipeline[funil] = {};
				if (!pipeline[funil][etapa]) pipeline[funil][etapa] = {
					count: 0,
					totalValue: 0,
					totalKwh: 0
				};
				pipeline[funil][etapa].count++;
				pipeline[funil][etapa].totalValue += Number(deal.valor) || 0;
				pipeline[funil][etapa].totalKwh += Number(deal.kwh) || 0;
			}
			return pipeline;
		}
		/**
		* Retorna contagem de Deals por status.
		*
		* @param {Object} filters
		* @returns {{ total: number, byStatus: Object }}
		*/
		getStatusSummary(filters = {}) {
			const deals = this.getDeals(filters);
			const byStatus = {};
			for (const deal of deals) {
				const s = deal.status || "Sem status";
				byStatus[s] = (byStatus[s] || 0) + 1;
			}
			return {
				total: deals.length,
				byStatus
			};
		}
		/**
		* Hidrata o Read Model a partir de um snapshot legado (Object ou Map).
		* Não publica CoreEvents. Não gera AuditEntries. Não usa Date.now().
		*
		* @param {Object|Map} deals   - Mapa dealId → objeto deal
		* @param {Object}     options
		* @param {boolean}    [options.replace=true] - Se true, limpa o Map antes de hidratar
		* @returns {{ received: number, hydrated: number, skipped: number, replaced: boolean }}
		*/
		hydrate(deals, options = {}) {
			if (deals === null || typeof deals !== "object" || Array.isArray(deals)) throw new TypeError("[CRMReadModel] hydrate() expects an Object or Map — received: " + (deals === null ? "null" : Array.isArray(deals) ? "Array" : typeof deals));
			const { replace = true } = options;
			if (replace) this._deals.clear();
			const entries = deals instanceof Map ? deals.entries() : Object.entries(deals);
			let received = 0;
			let hydrated = 0;
			let skipped = 0;
			for (const [dealId, deal] of entries) {
				received++;
				if (typeof dealId !== "string" || !dealId.trim() || !deal || typeof deal !== "object" || Array.isArray(deal)) {
					skipped++;
					continue;
				}
				const createdAt = Number(deal.createdAt || deal.ts) || 0;
				const updatedAt = Number(deal.updatedAt || deal.etapaTs || deal.ts || deal.createdAt) || 0;
				this._deals.set(dealId, this._normalizeDeal(dealId, deal, createdAt, updatedAt, "", "crm:deal:hydrated"));
				hydrated++;
			}
			this._hydrationCount++;
			const result = {
				received,
				hydrated,
				skipped,
				replaced: replace
			};
			this._lastHydration = result;
			return result;
		}
		/**
		* Snapshot de diagnóstico do Read Model.
		* @returns {{ dealCount: number, hydrationCount: number, lastHydration: Object|null }}
		*/
		getStats() {
			return {
				dealCount: this._deals.size,
				hydrationCount: this._hydrationCount,
				lastHydration: this._lastHydration ? Object.assign({}, this._lastHydration) : null
			};
		}
		/**
		* Limpa todo o estado derivado, incluindo histórico de hidratação.
		*/
		clear() {
			this._deals.clear();
			this._hydrationCount = 0;
			this._lastHydration = null;
		}
		_applyCreated(payload, createdAt, eventId, eventType) {
			const dealId = payload.id || payload.dealId;
			if (!dealId) return false;
			const snap = payload.deal || {};
			const src = {
				...payload,
				...snap
			};
			this._deals.set(dealId, this._normalizeDeal(dealId, src, snap.createdAt || createdAt, createdAt, eventId, eventType));
			return true;
		}
		_normalizeDeal(id, src, createdAt, updatedAt, lastEventId, lastEventType) {
			return {
				id,
				funil: src.funil || "",
				etapa: src.etapa || "",
				status: src.status || "Em andamento",
				valor: Number(src.valor) || 0,
				kwh: Number(src.kwh) || 0,
				responsavel: src.responsavel || "",
				responsavelUid: src.responsavelUid || "",
				captador: src.captador || "",
				captadorUid: src.captadorUid || "",
				createdAt,
				updatedAt,
				lastEventId,
				lastEventType
			};
		}
		_applyUpdated(payload, createdAt, eventId, eventType) {
			const dealId = payload.id || payload.dealId;
			if (!dealId) return false;
			const existing = this._deals.get(dealId) || this._emptyDeal(dealId, createdAt);
			const patch = payload.after || payload.deal || {};
			this._deals.set(dealId, Object.assign({}, existing, patch, {
				id: dealId,
				updatedAt: createdAt,
				lastEventId: eventId,
				lastEventType: eventType
			}));
			return true;
		}
		_applyStageChanged(payload, createdAt, eventId, eventType) {
			const dealId = payload.id || payload.dealId;
			if (!dealId) return false;
			const existing = this._deals.get(dealId) || this._emptyDeal(dealId, createdAt);
			this._deals.set(dealId, Object.assign({}, existing, {
				id: dealId,
				etapa: payload.toStage !== void 0 ? payload.toStage : existing.etapa,
				updatedAt: createdAt,
				lastEventId: eventId,
				lastEventType: eventType
			}));
			return true;
		}
		_applyStatus(payload, createdAt, eventId, eventType, forcedStatus) {
			const dealId = payload.id || payload.dealId;
			if (!dealId) return false;
			const existing = this._deals.get(dealId) || this._emptyDeal(dealId, createdAt);
			const patch = payload.after || payload.deal || {};
			this._deals.set(dealId, Object.assign({}, existing, patch, {
				id: dealId,
				status: forcedStatus,
				updatedAt: createdAt,
				lastEventId: eventId,
				lastEventType: eventType
			}));
			return true;
		}
		_emptyDeal(id, createdAt) {
			return {
				id,
				funil: "",
				etapa: "",
				status: "Em andamento",
				valor: 0,
				kwh: 0,
				responsavel: "",
				responsavelUid: "",
				captador: "",
				captadorUid: "",
				createdAt,
				updatedAt: createdAt,
				lastEventId: "",
				lastEventType: ""
			};
		}
	};
	//#endregion
	//#region ../../../read-models/crm/crm-read-model-integration.js
	/**
	* ESA OS — Read Models / CRM
	* CRMReadModelIntegration
	*
	* Conecta o Event Bus ao CRMReadModel.
	* Assina 'crm:deal:*' e aplica cada evento recebido ao Read Model.
	*
	* Responsabilidades:
	* - Assinar eventos de deal CRM no Event Bus após start()
	* - Encaminhar cada evento para CRMReadModel.apply()
	* - Registrar resultado (applied / skipped) via Logger opcional
	* - Manter contadores de diagnóstico
	* - Isolar erros internamente — nunca relançar para o Event Bus
	*
	* IMPORTANTE:
	* Não acessa Firebase. Não acessa Audit. Não modifica index.html.
	*/
	var SUBSCRIBER_OWNER = "CRMReadModelIntegration";
	/**
	* Integração Event Bus → CRMReadModel.
	*/
	var CRMReadModelIntegration = class {
		/**
		* @param {EventBus}       eventBus          - EventBus da ESA OS (injetado)
		* @param {CRMReadModel}   readModel         - Read Model alvo (injetado)
		* @param {Logger|null}    [logger=null]      - Logger opcional (injetado)
		*/
		constructor(eventBus, readModel, logger = null) {
			this._eventBus = eventBus;
			this._readModel = readModel;
			this._logger = logger !== null && typeof logger.child === "function" ? logger.child(SUBSCRIBER_OWNER) : logger;
			this._started = false;
			this._subscriberId = null;
			this._receivedCount = 0;
			this._appliedCount = 0;
			this._skippedCount = 0;
			this._errorCount = 0;
			this._lastError = null;
		}
		/**
		* Inicia a integração assinando 'crm:deal:*' no Event Bus.
		* Idempotente — chamadas adicionais quando já iniciado não têm efeito.
		* @throws {TypeError} Se eventBus ou readModel não expuserem os métodos necessários
		*/
		start() {
			if (this._started) return;
			if (!this._eventBus || typeof this._eventBus.subscribe !== "function") throw new TypeError("[CRMReadModelIntegration] eventBus must expose subscribe()");
			if (!this._readModel || typeof this._readModel.apply !== "function") throw new TypeError("[CRMReadModelIntegration] readModel must expose apply()");
			this._subscriberId = this._eventBus.subscribe("crm:deal:*", async (event) => this._handleEvent(event), { owner: SUBSCRIBER_OWNER });
			this._started = true;
		}
		/**
		* Para a integração removendo a assinatura do Event Bus.
		* @returns {boolean}
		*/
		stop() {
			if (!this._started) return false;
			const result = this._eventBus.unsubscribe(this._subscriberId);
			this._subscriberId = null;
			this._started = false;
			return result;
		}
		/**
		* @returns {boolean}
		*/
		isStarted() {
			return this._started;
		}
		/**
		* Snapshot de diagnóstico.
		* @returns {Object}
		*/
		getStats() {
			return {
				started: this._started,
				subscriberId: this._subscriberId,
				receivedCount: this._receivedCount,
				appliedCount: this._appliedCount,
				skippedCount: this._skippedCount,
				errorCount: this._errorCount,
				lastError: this._lastError,
				loggerEnabled: this._logger !== null
			};
		}
		async _handleEvent(event) {
			this._receivedCount++;
			try {
				const applied = this._readModel.apply(event);
				const dealId = event.payload && (event.payload.id || event.payload.dealId) || "";
				if (applied) {
					this._appliedCount++;
					if (this._logger) this._logger.info("CRM read model updated", {
						eventId: event.id,
						eventType: event.type,
						dealId
					});
				} else {
					this._skippedCount++;
					if (this._logger) this._logger.debug("CRM read model skipped event", {
						eventId: event.id,
						eventType: event.type,
						dealId
					});
				}
			} catch (err) {
				this._errorCount++;
				this._lastError = {
					name: err.name || "Error",
					message: err.message || String(err)
				};
				if (this._logger) this._logger.error("CRM read model integration failed", err, {
					eventId: event.id,
					eventType: event.type
				});
			}
		}
	};
	//#endregion
	//#region ../../../read-models/crm/crm-metrics.js
	/**
	* ESA OS — Read Models / CRM
	* CRMMetrics
	*
	* Calcula métricas derivadas sobre o estado do CRMReadModel.
	* Usa dependency injection — não instancia o Read Model internamente.
	*
	* Métricas disponíveis:
	* - Conversion Rate: Vendido / total
	* - Win Rate: Vendido / (Vendido + Perdido)
	* - Loss Rate: Perdido / (Vendido + Perdido)
	* - Paused Rate: Pausado / total
	* - Forecast: valor ponderado por status
	*
	* IMPORTANTE:
	* Não acessa Firebase. Não acessa Event Bus. Lê apenas do CRMReadModel.
	*/
	/**
	* Pesos aplicados ao valor de cada deal no cálculo de forecast.
	* Fixos nesta Sprint — configuráveis em versões futuras.
	*/
	var FORECAST_WEIGHTS = {
		"Vendido": 1,
		"Em andamento": .5,
		"Pausado": .2,
		"Perdido": 0,
		"Sem status": .25
	};
	var DEFAULT_WEIGHT = .25;
	/**
	* Calculadora de métricas CRM.
	*/
	var CRMMetrics = class {
		/**
		* @param {CRMReadModel} readModel - Instância do Read Model (injetada)
		*/
		constructor(readModel) {
			this._readModel = readModel;
		}
		/**
		* Conversão: Deals com status "Vendido" sobre o total.
		*
		* @param {Object} filters - Filtros passados para getDeals()
		* @returns {{ total: number, converted: number, rate: number }}
		*/
		getConversionRate(filters = {}) {
			const deals = this._readModel.getDeals(filters);
			const total = deals.length;
			const converted = deals.filter((d) => d.status === "Vendido").length;
			return {
				total,
				converted,
				rate: total === 0 ? 0 : converted / total * 100
			};
		}
		/**
		* Win Rate: Vendido / (Vendido + Perdido).
		* Denominator considera apenas deals com decisão (Vendido ou Perdido).
		*
		* @param {Object} filters
		* @returns {{ decided: number, won: number, rate: number }}
		*/
		getWinRate(filters = {}) {
			const deals = this._readModel.getDeals(filters);
			const decided = deals.filter((d) => d.status === "Vendido" || d.status === "Perdido").length;
			const won = deals.filter((d) => d.status === "Vendido").length;
			return {
				decided,
				won,
				rate: decided === 0 ? 0 : won / decided * 100
			};
		}
		/**
		* Loss Rate: Perdido / (Vendido + Perdido).
		*
		* @param {Object} filters
		* @returns {{ decided: number, lost: number, rate: number }}
		*/
		getLossRate(filters = {}) {
			const deals = this._readModel.getDeals(filters);
			const decided = deals.filter((d) => d.status === "Vendido" || d.status === "Perdido").length;
			const lost = deals.filter((d) => d.status === "Perdido").length;
			return {
				decided,
				lost,
				rate: decided === 0 ? 0 : lost / decided * 100
			};
		}
		/**
		* Paused Rate: Pausado / total.
		*
		* @param {Object} filters
		* @returns {{ total: number, paused: number, rate: number }}
		*/
		getPausedRate(filters = {}) {
			const deals = this._readModel.getDeals(filters);
			const total = deals.length;
			const paused = deals.filter((d) => d.status === "Pausado").length;
			return {
				total,
				paused,
				rate: total === 0 ? 0 : paused / total * 100
			};
		}
		/**
		* Forecast básico: soma ponderada dos valores dos deals por status.
		*
		* Pesos:
		*   Vendido       → 1.00
		*   Em andamento  → 0.50
		*   Pausado       → 0.20
		*   Perdido       → 0.00
		*   Sem status    → 0.25
		*   outros        → 0.25
		*
		* @param {Object} filters
		* @returns {{ totalValue: number, weightedValue: number, dealCount: number, byStatus: Object }}
		*/
		getForecast(filters = {}) {
			const deals = this._readModel.getDeals(filters);
			let totalValue = 0;
			let weightedValue = 0;
			const byStatus = {};
			for (const deal of deals) {
				const status = deal.status || "Sem status";
				const value = Number(deal.valor) || 0;
				const weight = FORECAST_WEIGHTS[status] !== void 0 ? FORECAST_WEIGHTS[status] : DEFAULT_WEIGHT;
				const wv = value * weight;
				totalValue += value;
				weightedValue += wv;
				if (!byStatus[status]) byStatus[status] = {
					count: 0,
					totalValue: 0,
					weight,
					weightedValue: 0
				};
				byStatus[status].count++;
				byStatus[status].totalValue += value;
				byStatus[status].weightedValue += wv;
			}
			return {
				totalValue,
				weightedValue,
				dealCount: deals.length,
				byStatus
			};
		}
	};
	//#endregion
	//#region ../../../read-models/crm/index.js
	/**
	* Singleton do Read Model CRM da plataforma ESA OS.
	* @type {CRMReadModel}
	*/
	var crmReadModel = new CRMReadModel();
	/**
	* Singleton de métricas CRM — usa crmReadModel como fonte.
	* @type {CRMMetrics}
	*/
	var crmMetrics = new CRMMetrics(crmReadModel);
	//#endregion
	//#region ../../../queries/crm/crm-query-result.js
	/**
	* ESA OS — Queries / CRM
	* CRMQueryResult
	*
	* Envelope padrão para todas as respostas do CRMQueryService.
	* Garante estrutura consistente para UI, Solana IA, APIs e relatórios.
	*
	* IMPORTANTE:
	* toJSON() retorna snapshots rasos — não expõe referências internas mutáveis.
	* Não implementa deep clone: use para esta Sprint clone raso (Object.assign / slice).
	*/
	var CRMQueryResult = class {
		/**
		* @param {*}      data          - Dado principal da consulta
		* @param {Object} [metadata={}] - Metadados descritivos da consulta
		*/
		constructor(data, metadata = {}) {
			this.data = data;
			this.metadata = metadata;
			this.generatedAt = Date.now();
		}
		/**
		* Retorna snapshot serializado da resposta.
		* Arrays retornam novo array. Objetos retornam clone raso.
		* Não expõe referências internas mutáveis.
		*
		* @returns {{ data: *, metadata: Object, generatedAt: number }}
		*/
		toJSON() {
			let data;
			if (Array.isArray(this.data)) data = this.data.slice();
			else if (this.data !== null && typeof this.data === "object") data = Object.assign({}, this.data);
			else data = this.data;
			return {
				data,
				metadata: Object.assign({}, this.metadata),
				generatedAt: this.generatedAt
			};
		}
	};
	//#endregion
	//#region ../../../queries/crm/crm-pipeline-analyzer.js
	/**
	* ESA OS — Queries / CRM
	* CRMPipelineAnalyzer
	*
	* Análise operacional de aging e saúde do pipeline CRM.
	* Identifica riscos gerenciais: deals críticos, em risco, sem próxima ação.
	*
	* Padrão: Analytic Query (extensão de CRMMetrics no plano arquitetural)
	* Usa dependency injection — não importa singletons diretamente.
	*
	* IMPORTANTE:
	* Não acessa Firebase. Não acessa Audit. Não acessa Event Bus.
	* Usa apenas CRMReadModel.getDeals() como fonte.
	*
	* Estratégia de timestamp para aging:
	*   1. updatedAt — captura stage-changed, updated e status events (qualquer evento
	*      que toque o deal atualiza este campo no CRMReadModel via _applyX())
	*   2. createdAt — fallback quando updatedAt = 0 ou ausente
	*   Não usa Date.now() espalhado. Aceita options.referenceDate para testes determinísticos.
	*
	* Nota sobre proximaAcao:
	*   CRMReadModel._normalizeDeal() armazena um conjunto fixo de campos e não inclui
	*   proximaAcao por padrão. O campo pode estar presente em deals atualizados via
	*   crm:deal:updated com payload.after.proximaAcao. A verificação é defensiva.
	*/
	/**
	* Thresholds de aging em dias (centralizados — sem números mágicos espalhados).
	*
	* fresh:     0 a 7 dias
	* attention: 8 a 14 dias
	* risk:      15 a 30 dias
	* critical:  31+ dias
	*
	* @type {{ fresh: number, attention: number, risk: number }}
	*/
	var AGING_THRESHOLDS = {
		fresh: 7,
		attention: 14,
		risk: 30
	};
	/** Milissegundos em um dia solar (86.400.000). */
	var MS_PER_DAY$2 = 864e5;
	/**
	* Analisador de saúde do pipeline CRM.
	*/
	var CRMPipelineAnalyzer = class {
		/**
		* @param {CRMReadModel} readModel - Instância do Read Model CRM (injetada)
		*/
		constructor(readModel) {
			this._readModel = readModel;
		}
		/**
		* Retorna resumo de saúde do pipeline com distribuição de aging e valores em risco.
		*
		* @param {Object} filters              - Filtros passados para getDeals()
		* @param {Object} [options={}]
		* @param {number} [options.referenceDate] - Timestamp de referência em ms (para testes determinísticos)
		* @returns {{
		*   totalDeals:            number,
		*   freshDeals:            number,
		*   attentionDeals:        number,
		*   riskDeals:             number,
		*   criticalDeals:         number,
		*   dealsWithoutNextAction:number,
		*   valueAtRisk:           number,
		*   criticalValue:         number,
		*   agingDistribution:     Object,
		*   referenceDate:         number,
		* }}
		*/
		getPipelineHealth(filters = {}, options = {}) {
			this._requireReadModel();
			const refMs = this._referenceMs(options);
			const deals = this._readModel.getDeals(filters);
			let freshDeals = 0;
			let attentionDeals = 0;
			let riskDeals = 0;
			let criticalDeals = 0;
			let dealsWithoutNextAction = 0;
			let valueAtRisk = 0;
			let criticalValue = 0;
			const agingDistribution = {
				fresh: {
					count: 0,
					totalValue: 0
				},
				attention: {
					count: 0,
					totalValue: 0
				},
				risk: {
					count: 0,
					totalValue: 0
				},
				critical: {
					count: 0,
					totalValue: 0
				}
			};
			for (const deal of deals) {
				const days = this._agingDays(deal, refMs);
				const level = this._classifyAging(days);
				const valor = Number(deal.valor) || 0;
				if (level === "fresh") freshDeals++;
				else if (level === "attention") attentionDeals++;
				else if (level === "risk") {
					riskDeals++;
					valueAtRisk += valor;
				} else if (level === "critical") {
					criticalDeals++;
					valueAtRisk += valor;
					criticalValue += valor;
				}
				const bucket = agingDistribution[level];
				if (bucket) {
					bucket.count++;
					bucket.totalValue += valor;
				}
				if (!this._hasNextAction(deal)) dealsWithoutNextAction++;
			}
			return {
				totalDeals: deals.length,
				freshDeals,
				attentionDeals,
				riskDeals,
				criticalDeals,
				dealsWithoutNextAction,
				valueAtRisk,
				criticalValue,
				agingDistribution,
				referenceDate: refMs
			};
		}
		/**
		* Retorna lista gerencial de deals críticos (aging > 30 dias).
		* Ordenada por agingDays DESC (mais crítico primeiro).
		*
		* @param {Object} filters
		* @param {Object} [options={}]
		* @returns {Array<DealItem>}
		*/
		getCriticalDeals(filters = {}, options = {}) {
			this._requireReadModel();
			const refMs = this._referenceMs(options);
			const deals = this._readModel.getDeals(filters);
			const items = [];
			for (const deal of deals) {
				const days = this._agingDays(deal, refMs);
				const level = this._classifyAging(days);
				if (level === "critical") items.push(this._toDealItem(deal, days, level));
			}
			items.sort((a, b) => b.agingDays - a.agingDays);
			return items;
		}
		/**
		* Retorna lista gerencial de deals sem próxima ação registrada.
		* Ordenada por agingDays DESC (mais urgente primeiro).
		*
		* @param {Object} filters
		* @param {Object} [options={}]
		* @returns {Array<DealItem>}
		*/
		getDealsWithoutNextAction(filters = {}, options = {}) {
			this._requireReadModel();
			const refMs = this._referenceMs(options);
			const deals = this._readModel.getDeals(filters);
			const items = [];
			for (const deal of deals) if (!this._hasNextAction(deal)) {
				const days = this._agingDays(deal, refMs);
				const level = this._classifyAging(days);
				items.push(this._toDealItem(deal, days, level));
			}
			items.sort((a, b) => b.agingDays - a.agingDays);
			return items;
		}
		/**
		* Escolhe o timestamp mais relevante do deal para cálculo de aging.
		*
		* Prioridade:
		*   1. updatedAt — captura qualquer evento CRM que tenha tocado o deal
		*   2. createdAt — fallback quando updatedAt = 0 ou ausente
		*
		* Retorna 0 se nenhum timestamp válido estiver disponível.
		*/
		_lastRelevantAt(deal) {
			const u = Number(deal.updatedAt);
			if (u > 0) return u;
			const c = Number(deal.createdAt);
			return c > 0 ? c : 0;
		}
		/**
		* Calcula a idade operacional do deal em dias inteiros.
		* Retorna null se o timestamp for inválido ou ausente (updatedAt=0, createdAt=0).
		* Retorna 0 se referenceMs < lastRelevantAt (deal "do futuro" — anomalia de dados).
		*/
		_agingDays(deal, referenceMs) {
			const t = this._lastRelevantAt(deal);
			if (t <= 0) return null;
			const ms = referenceMs - t;
			return ms >= 0 ? Math.floor(ms / MS_PER_DAY$2) : 0;
		}
		/**
		* Classifica o aging em faixa gerencial usando AGING_THRESHOLDS centralizados.
		* null → 'unknown' (timestamp ausente/inválido — não entra nas faixas de contagem).
		*
		* @param {number|null} days
		* @returns {'fresh'|'attention'|'risk'|'critical'|'unknown'}
		*/
		_classifyAging(days) {
			if (days === null) return "unknown";
			if (days <= AGING_THRESHOLDS.fresh) return "fresh";
			if (days <= AGING_THRESHOLDS.attention) return "attention";
			if (days <= AGING_THRESHOLDS.risk) return "risk";
			return "critical";
		}
		/**
		* Verifica se o deal possui próxima ação ou follow-up registrado.
		* Verificação defensiva: checa proximaAcao e followUp.
		*/
		_hasNextAction(deal) {
			const pa = deal.proximaAcao;
			if (pa && String(pa).trim()) return true;
			const fu = deal.followUp;
			if (fu && String(fu).trim()) return true;
			return false;
		}
		/**
		* Normaliza um deal para a representação gerencial de lista.
		*
		* @param {Object}      deal
		* @param {number|null} agingDays
		* @param {string}      agingLevel
		* @returns {DealItem}
		*/
		_toDealItem(deal, agingDays, agingLevel) {
			return {
				id: deal.id || "",
				name: deal.nome || deal.cliente || deal.id || "",
				company: deal.empresa || "",
				responsible: deal.responsavel || "",
				pipeline: deal.funil || "",
				stage: deal.etapa || "",
				status: deal.status || "",
				value: Number(deal.valor) || 0,
				agingDays: agingDays !== null ? agingDays : -1,
				agingLevel,
				lastRelevantAt: this._lastRelevantAt(deal),
				nextActionAt: deal.proximaAcao || null
			};
		}
		/**
		* Resolve o timestamp de referência para aging.
		* Permite injeção via options.referenceDate para testes determinísticos.
		*/
		_referenceMs(options) {
			const r = options && options.referenceDate;
			return typeof r === "number" && r > 0 ? r : Date.now();
		}
		_requireReadModel() {
			if (!this._readModel || typeof this._readModel.getDeals !== "function") throw new TypeError("[CRMPipelineAnalyzer] readModel must expose getDeals()");
		}
	};
	//#endregion
	//#region ../../../queries/crm/crm-risk-signal-analyzer.js
	/**
	* ESA OS — Queries / CRM
	* CRMRiskSignalAnalyzer
	*
	* Análise de sinais de risco comercial do pipeline CRM.
	* Produz sinais gerenciais explícitos, priorizados e deduplicados a partir dos deals.
	*
	* Reutiliza AGING_THRESHOLDS de CRMPipelineAnalyzer — não duplica lógica de classificação.
	* Usa dependency injection — não importa singletons diretamente.
	*
	* IMPORTANTE:
	* Não acessa Firebase. Não acessa Audit. Não acessa Event Bus.
	* Usa apenas CRMReadModel.getDeals() como fonte.
	*
	* Política de deduplicação (por deal, por ordem de especificidade):
	*   CRITICAL_NO_NEXT_ACTION: emitido se critical + sem próxima ação.
	*   HIGH_VALUE_STALE:        emitido se valor >= HIGH_VALUE_THRESHOLD + aging risk/critical.
	*                            Pode coexistir com CRITICAL_NO_NEXT_ACTION (dimensões distintas:
	*                            valor exposto vs ausência de ação). Coexistência intencional.
	*   STALE_DEAL:              emitido se risk/critical E nenhum sinal específico já emitido.
	*                            Suprimido quando CRITICAL_NO_NEXT_ACTION ou HIGH_VALUE_STALE
	*                            já cobrem o mesmo deal com maior especificidade.
	*   RESPONSIBLE_RISK_CONCENTRATION: sinal agregado por responsável. Sem deduplicação com
	*                            sinais de deal (dimensão diferente: concentração de portfólio).
	*   PIPELINE_RISK_CONCENTRATION:    sinal agregado por funil. Sem deduplicação com sinais
	*                            de deal (dimensão diferente: saúde do funil).
	*/
	/** Tipos de sinal de risco (centralizados — sem strings mágicas espalhadas). */
	var SIGNAL_TYPES = {
		CRITICAL_NO_NEXT_ACTION: "CRITICAL_NO_NEXT_ACTION",
		HIGH_VALUE_STALE: "HIGH_VALUE_STALE",
		STALE_DEAL: "STALE_DEAL",
		RESPONSIBLE_RISK_CONCENTRATION: "RESPONSIBLE_RISK_CONCENTRATION",
		PIPELINE_RISK_CONCENTRATION: "PIPELINE_RISK_CONCENTRATION"
	};
	/** Níveis de severidade (centralizados). */
	var SEVERITY_LEVELS = {
		info: "info",
		attention: "attention",
		risk: "risk",
		critical: "critical"
	};
	/**
	* Threshold de alto valor para HIGH_VALUE_STALE (R$ 500.000).
	* Deals com valor >= HIGH_VALUE_THRESHOLD em faixa risk/critical geram este sinal.
	*/
	var HIGH_VALUE_THRESHOLD = 5e5;
	/**
	* Thresholds de concentração de risco (centralizados — sem números mágicos espalhados).
	*
	* responsibleMinDeals:   mínimo de deals risk/critical por responsável para disparar sinal
	* responsibleMinPercent: percentual mínimo de deals risk/critical na carteira do responsável
	* pipelineMinDeals:      mínimo de deals elegíveis no funil
	* pipelineMinPercent:    percentual mínimo de deals risk/critical no funil
	*/
	var RISK_THRESHOLDS = {
		responsibleMinDeals: 3,
		responsibleMinPercent: .5,
		pipelineMinDeals: 5,
		pipelineMinPercent: .4
	};
	/** Ordem de priorização de severidade (menor índice = maior prioridade). */
	var SEVERITY_ORDER$1 = {
		[SEVERITY_LEVELS.critical]: 0,
		[SEVERITY_LEVELS.risk]: 1,
		[SEVERITY_LEVELS.attention]: 2,
		[SEVERITY_LEVELS.info]: 3
	};
	var MS_PER_DAY$1 = 864e5;
	function _lastRelevantAt$1(deal) {
		const u = Number(deal.updatedAt);
		if (u > 0) return u;
		const c = Number(deal.createdAt);
		return c > 0 ? c : 0;
	}
	function _agingDays$1(deal, referenceMs) {
		const t = _lastRelevantAt$1(deal);
		if (t <= 0) return null;
		const ms = referenceMs - t;
		return ms >= 0 ? Math.floor(ms / MS_PER_DAY$1) : 0;
	}
	function _classifyAging$1(days) {
		if (days === null) return "unknown";
		if (days <= AGING_THRESHOLDS.fresh) return "fresh";
		if (days <= AGING_THRESHOLDS.attention) return "attention";
		if (days <= AGING_THRESHOLDS.risk) return "risk";
		return "critical";
	}
	function _hasNextAction$1(deal) {
		const pa = deal.proximaAcao;
		if (pa && String(pa).trim()) return true;
		const fu = deal.followUp;
		if (fu && String(fu).trim()) return true;
		return false;
	}
	/**
	* Analisador de sinais de risco comercial do pipeline CRM.
	*/
	var CRMRiskSignalAnalyzer = class {
		/**
		* @param {CRMReadModel} readModel - Instância do Read Model CRM (injetada)
		*/
		constructor(readModel) {
			this._readModel = readModel;
		}
		/**
		* Retorna lista priorizada de sinais de risco comercial.
		*
		* @param {Object} filters
		* @param {Object} [options={}]
		* @param {number} [options.referenceDate] - Timestamp de referência em ms (testes determinísticos)
		* @returns {RiskSignal[]}
		*/
		getRiskSignals(filters = {}, options = {}) {
			this._requireReadModel();
			const refMs = this._referenceMs(options);
			const deals = this._readModel.getDeals(filters);
			const signals = this._generateSignals(deals, refMs);
			this._sortSignals(signals);
			return signals;
		}
		/**
		* Retorna apenas sinais com severity === 'critical'.
		*
		* @param {Object} filters
		* @param {Object} [options={}]
		* @returns {RiskSignal[]}
		*/
		getCriticalRiskSignals(filters = {}, options = {}) {
			return this.getRiskSignals(filters, options).filter((s) => s.severity === SEVERITY_LEVELS.critical);
		}
		/**
		* Retorna resumo gerencial com contagens, valor exposto e lista priorizada de sinais.
		*
		* @param {Object} filters
		* @param {Object} [options={}]
		* @returns {RiskSignalSummary}
		*/
		getRiskSignalSummary(filters = {}, options = {}) {
			this._requireReadModel();
			const refMs = this._referenceMs(options);
			const deals = this._readModel.getDeals(filters);
			const signals = this._generateSignals(deals, refMs);
			this._sortSignals(signals);
			return this._buildSummary(signals, deals);
		}
		_generateSignals(deals, refMs) {
			const signals = [];
			this._generateDealSignals(deals, refMs, signals);
			this._generateResponsibleSignals(deals, refMs, signals);
			this._generatePipelineSignals(deals, refMs, signals);
			return signals;
		}
		_generateDealSignals(deals, refMs, signals) {
			for (const deal of deals) {
				const days = _agingDays$1(deal, refMs);
				const level = _classifyAging$1(days);
				const valor = Number(deal.valor) || 0;
				if (level !== "risk" && level !== "critical") continue;
				const emitted = /* @__PURE__ */ new Set();
				if (level === "critical" && !_hasNextAction$1(deal)) {
					signals.push(this._signalCriticalNoNextAction(deal, days, valor));
					emitted.add(SIGNAL_TYPES.CRITICAL_NO_NEXT_ACTION);
				}
				if (valor >= 5e5) {
					signals.push(this._signalHighValueStale(deal, days, level, valor));
					emitted.add(SIGNAL_TYPES.HIGH_VALUE_STALE);
				}
				if (emitted.size === 0) signals.push(this._signalStaleDeal(deal, days, level, valor));
			}
		}
		_generateResponsibleSignals(deals, refMs, signals) {
			const map = this._buildResponsibleMap(deals, refMs);
			for (const [responsible, { eligible, atRisk }] of map) {
				if (atRisk.length < RISK_THRESHOLDS.responsibleMinDeals) continue;
				const percent = atRisk.length / eligible.length;
				if (percent < RISK_THRESHOLDS.responsibleMinPercent) continue;
				const totalVal = atRisk.reduce((s, d) => s + (Number(d.valor) || 0), 0);
				signals.push(this._signalResponsibleConcentration(responsible, atRisk, eligible, percent, totalVal));
			}
		}
		_generatePipelineSignals(deals, refMs, signals) {
			const map = this._buildPipelineMap(deals, refMs);
			for (const [pipeline, { eligible, atRisk }] of map) {
				if (eligible.length < RISK_THRESHOLDS.pipelineMinDeals) continue;
				const percent = atRisk.length / eligible.length;
				if (percent < RISK_THRESHOLDS.pipelineMinPercent) continue;
				signals.push(this._signalPipelineConcentration(pipeline, atRisk, eligible, percent));
			}
		}
		_signalCriticalNoNextAction(deal, agingDays, valor) {
			return this._toSignal(SIGNAL_TYPES.CRITICAL_NO_NEXT_ACTION, SEVERITY_LEVELS.critical, {
				title: "Deal crítico sem próxima ação",
				description: `Deal parado há ${agingDays} dias sem próxima ação registrada.`,
				dealId: deal.id || null,
				dealName: deal.nome || deal.cliente || deal.id || null,
				responsible: deal.responsavel || null,
				pipeline: deal.funil || null,
				stage: deal.etapa || null,
				value: valor > 0 ? valor : null,
				agingDays,
				metadata: { agingLevel: "critical" }
			});
		}
		_signalHighValueStale(deal, agingDays, agingLevel, valor) {
			const sev = agingLevel === "critical" ? SEVERITY_LEVELS.critical : SEVERITY_LEVELS.risk;
			return this._toSignal(SIGNAL_TYPES.HIGH_VALUE_STALE, sev, {
				title: "Deal de alto valor parado",
				description: `Deal com valor superior a R$ 500 mil parado há ${agingDays} dias.`,
				dealId: deal.id || null,
				dealName: deal.nome || deal.cliente || deal.id || null,
				responsible: deal.responsavel || null,
				pipeline: deal.funil || null,
				stage: deal.etapa || null,
				value: valor,
				agingDays,
				metadata: {
					agingLevel,
					threshold: HIGH_VALUE_THRESHOLD
				}
			});
		}
		_signalStaleDeal(deal, agingDays, agingLevel, valor) {
			const sev = agingLevel === "critical" ? SEVERITY_LEVELS.critical : SEVERITY_LEVELS.risk;
			return this._toSignal(SIGNAL_TYPES.STALE_DEAL, sev, {
				title: `Deal ${agingLevel === "critical" ? "crítico" : "em risco"} parado`,
				description: `Deal parado há ${agingDays} dias.`,
				dealId: deal.id || null,
				dealName: deal.nome || deal.cliente || deal.id || null,
				responsible: deal.responsavel || null,
				pipeline: deal.funil || null,
				stage: deal.etapa || null,
				value: valor > 0 ? valor : null,
				agingDays,
				metadata: { agingLevel }
			});
		}
		_signalResponsibleConcentration(responsible, atRisk, eligible, percent, totalVal) {
			const pct = Math.round(percent * 100);
			return this._toSignal(SIGNAL_TYPES.RESPONSIBLE_RISK_CONCENTRATION, SEVERITY_LEVELS.risk, {
				title: `Concentração de risco: ${responsible}`,
				description: `${responsible} possui ${atRisk.length} deals em risco/crítico (${pct}% da carteira).`,
				dealId: null,
				dealName: null,
				responsible,
				pipeline: null,
				stage: null,
				value: totalVal > 0 ? totalVal : null,
				agingDays: null,
				metadata: {
					atRiskCount: atRisk.length,
					eligibleCount: eligible.length,
					percent: Math.round(percent * 100) / 100
				}
			});
		}
		_signalPipelineConcentration(pipeline, atRisk, eligible, percent) {
			const pct = Math.round(percent * 100);
			return this._toSignal(SIGNAL_TYPES.PIPELINE_RISK_CONCENTRATION, SEVERITY_LEVELS.risk, {
				title: `Concentração de risco no funil: ${pipeline}`,
				description: `Funil ${pipeline}: ${atRisk.length}/${eligible.length} deals em risco/crítico (${pct}%).`,
				dealId: null,
				dealName: null,
				responsible: null,
				pipeline,
				stage: null,
				value: null,
				agingDays: null,
				metadata: {
					atRiskCount: atRisk.length,
					eligibleCount: eligible.length,
					percent: Math.round(percent * 100) / 100
				}
			});
		}
		_buildResponsibleMap(deals, refMs) {
			const map = /* @__PURE__ */ new Map();
			for (const deal of deals) {
				const r = deal.responsavel;
				if (!r || !String(r).trim()) continue;
				if (!map.has(r)) map.set(r, {
					eligible: [],
					atRisk: []
				});
				const entry = map.get(r);
				entry.eligible.push(deal);
				const level = _classifyAging$1(_agingDays$1(deal, refMs));
				if (level === "risk" || level === "critical") entry.atRisk.push(deal);
			}
			return map;
		}
		_buildPipelineMap(deals, refMs) {
			const map = /* @__PURE__ */ new Map();
			for (const deal of deals) {
				const p = deal.funil;
				if (!p || !String(p).trim()) continue;
				if (!map.has(p)) map.set(p, {
					eligible: [],
					atRisk: []
				});
				const entry = map.get(p);
				entry.eligible.push(deal);
				const level = _classifyAging$1(_agingDays$1(deal, refMs));
				if (level === "risk" || level === "critical") entry.atRisk.push(deal);
			}
			return map;
		}
		_sortSignals(signals) {
			signals.sort((a, b) => {
				const sv = (SEVERITY_ORDER$1[a.severity] ?? 99) - (SEVERITY_ORDER$1[b.severity] ?? 99);
				if (sv !== 0) return sv;
				const va = a.value ?? -1;
				const vb = b.value ?? -1;
				if (vb !== va) return vb - va;
				const aa = a.agingDays ?? -1;
				const ab = b.agingDays ?? -1;
				if (ab !== aa) return ab - aa;
				return String(a.id).localeCompare(String(b.id));
			});
		}
		_buildSummary(signals, deals) {
			const dealValueMap = /* @__PURE__ */ new Map();
			for (const deal of deals) if (deal.id) dealValueMap.set(deal.id, Number(deal.valor) || 0);
			const affectedDealIds = /* @__PURE__ */ new Set();
			const byType = {};
			const bySeverity = {
				critical: 0,
				risk: 0,
				attention: 0,
				info: 0
			};
			for (const signal of signals) {
				if (signal.dealId) affectedDealIds.add(signal.dealId);
				byType[signal.type] = (byType[signal.type] || 0) + 1;
				if (signal.severity in bySeverity) bySeverity[signal.severity]++;
			}
			let valueExposed = 0;
			for (const dealId of affectedDealIds) valueExposed += dealValueMap.get(dealId) || 0;
			return {
				totalSignals: signals.length,
				criticalSignals: bySeverity.critical,
				riskSignals: bySeverity.risk,
				attentionSignals: bySeverity.attention,
				infoSignals: bySeverity.info,
				affectedDeals: affectedDealIds.size,
				valueExposed,
				byType,
				bySeverity,
				signals
			};
		}
		_toSignal(type, severity, { title, description, dealId, dealName, responsible, pipeline, stage, value, agingDays, metadata }) {
			return {
				id: `${type}::${dealId != null ? String(dealId) : String(responsible || pipeline || "global").replace(/\W+/g, "_").slice(0, 40)}`,
				type,
				severity,
				title: title || "",
				description: description || "",
				dealId: dealId != null ? dealId : null,
				dealName: dealName != null ? dealName : null,
				responsible: responsible != null ? responsible : null,
				pipeline: pipeline != null ? pipeline : null,
				stage: stage != null ? stage : null,
				value: typeof value === "number" && !isNaN(value) ? value : null,
				agingDays: typeof agingDays === "number" && !isNaN(agingDays) ? agingDays : null,
				createdAt: Date.now(),
				metadata: Object.assign({}, metadata)
			};
		}
		_referenceMs(options) {
			const r = options && options.referenceDate;
			return typeof r === "number" && r > 0 ? r : Date.now();
		}
		_requireReadModel() {
			if (!this._readModel || typeof this._readModel.getDeals !== "function") throw new TypeError("[CRMRiskSignalAnalyzer] readModel must expose getDeals()");
		}
	};
	//#endregion
	//#region ../../../queries/crm/crm-action-priority-analyzer.js
	/**
	* ESA OS — Queries / CRM
	* CRMActionPriorityAnalyzer
	*
	* Priorização gerencial de ações comerciais.
	* Combina aging (via AGING_THRESHOLDS de CRMPipelineAnalyzer) e sinais de risco
	* (via CRMRiskSignalAnalyzer) em uma fila priorizada de deals que merecem atenção.
	*
	* Política de dupla contribuição (intencional, documentada e testada):
	*   CRITICAL_NO_NEXT_ACTION (+35) e NO_NEXT_ACTION (+20) podem coexistir no mesmo deal.
	*   Razão: o sinal representa gravidade específica (ausência de ação num deal crítico);
	*   o bônus genérico representa ausência objetiva de próxima ação em qualquer deal
	*   risk/critical. Dimensões distintas — acumulação intencional.
	*
	* IMPORTANTE:
	* Não acessa Firebase. Não acessa Audit. Não acessa Event Bus.
	* Usa apenas CRMReadModel.getDeals() como fonte (diretamente e via CRMRiskSignalAnalyzer).
	* Usa dependency injection — não importa singletons diretamente.
	*/
	/** Níveis de prioridade gerencial (centralizados — sem strings mágicas espalhadas). */
	var PRIORITY_LEVELS = {
		low: "low",
		medium: "medium",
		high: "high",
		urgent: "urgent"
	};
	/**
	* Pesos de pontuação (centralizados — sem números mágicos espalhados).
	*
	* aging:        base score por nível de aging (fresh=0, attention=15, risk=35, critical=60)
	* signal:       bônus por tipo de sinal de deal (deal-level signals only)
	* value:        bônus por faixa de valor — usar o MAIOR bracket aplicável, sem acumulação
	* noNextAction: bônus adicional para deals risk/critical sem próxima ação registrada
	*               (pode coexistir com CRITICAL_NO_NEXT_ACTION — ver política de dupla contribuição)
	*/
	var SCORE_WEIGHTS = {
		aging: {
			fresh: 0,
			attention: 15,
			risk: 35,
			critical: 60
		},
		signal: {
			[SIGNAL_TYPES.CRITICAL_NO_NEXT_ACTION]: 35,
			[SIGNAL_TYPES.HIGH_VALUE_STALE]: 25,
			[SIGNAL_TYPES.STALE_DEAL]: 15
		},
		value: {
			high: 15,
			veryHigh: 25
		},
		noNextAction: 20
	};
	/**
	* Thresholds de valor para bônus de pontuação.
	* high:     R$ 500.000 — alinha com HIGH_VALUE_THRESHOLD do CRMRiskSignalAnalyzer
	* veryHigh: R$ 1.000.000 — bracket de criticidade adicional
	*/
	var VALUE_THRESHOLDS = {
		high: 5e5,
		veryHigh: 1e6
	};
	/**
	* Thresholds de score para determinação do nível de prioridade (centralizados).
	* low:    0–24  | medium: 25–49 | high: 50–74 | urgent: 75–100
	*/
	var PRIORITY_SCORE_THRESHOLDS = {
		medium: 25,
		high: 50,
		urgent: 75
	};
	var MS_PER_DAY = 864e5;
	var AGING_REASON_LABELS = {
		attention: "Aging em atenção (8–14 dias)",
		risk: "Deal em risco por aging (15–30 dias)",
		critical: "Deal crítico por aging (31+ dias)"
	};
	var SIGNAL_REASON_LABELS = {
		[SIGNAL_TYPES.CRITICAL_NO_NEXT_ACTION]: "Deal crítico sem próxima ação",
		[SIGNAL_TYPES.HIGH_VALUE_STALE]: "Deal de alto valor parado",
		[SIGNAL_TYPES.STALE_DEAL]: "Deal parado (risco ou crítico)"
	};
	function _lastRelevantAt(deal) {
		const u = Number(deal.updatedAt);
		if (u > 0) return u;
		const c = Number(deal.createdAt);
		return c > 0 ? c : 0;
	}
	function _agingDays(deal, referenceMs) {
		const t = _lastRelevantAt(deal);
		if (t <= 0) return null;
		const ms = referenceMs - t;
		return ms >= 0 ? Math.floor(ms / MS_PER_DAY) : 0;
	}
	function _classifyAging(days) {
		if (days === null) return "unknown";
		if (days <= AGING_THRESHOLDS.fresh) return "fresh";
		if (days <= AGING_THRESHOLDS.attention) return "attention";
		if (days <= AGING_THRESHOLDS.risk) return "risk";
		return "critical";
	}
	function _hasNextAction(deal) {
		const pa = deal.proximaAcao;
		if (pa && String(pa).trim()) return true;
		const fu = deal.followUp;
		if (fu && String(fu).trim()) return true;
		return false;
	}
	/**
	* Analisador de prioridades de ação comercial.
	*/
	var CRMActionPriorityAnalyzer = class {
		/**
		* @param {CRMReadModel} readModel - Instância do Read Model CRM (injetada)
		*/
		constructor(readModel) {
			this._readModel = readModel;
			this._riskAnalyzer = null;
		}
		/**
		* Retorna lista priorizada de ações comerciais por deal.
		*
		* @param {Object} filters
		* @param {Object} [options={}]
		* @param {number} [options.referenceDate] - Timestamp ms (testes determinísticos)
		* @returns {ActionPriority[]}
		*/
		getActionPriorities(filters = {}, options = {}) {
			this._requireReadModel();
			const refMs = this._referenceMs(options);
			const deals = this._readModel.getDeals(filters);
			const signals = this._getRiskAnalyzer().getRiskSignals(filters, options);
			const signalMap = this._buildDealSignalMap(signals);
			const items = deals.map((deal) => this._buildPriority(deal, refMs, signalMap));
			this._sortPriorities(items);
			return items;
		}
		/**
		* Retorna apenas prioridades com nível 'urgent'.
		*
		* @param {Object} filters
		* @param {Object} [options={}]
		* @returns {ActionPriority[]}
		*/
		getUrgentActionPriorities(filters = {}, options = {}) {
			return this.getActionPriorities(filters, options).filter((p) => p.priorityLevel === PRIORITY_LEVELS.urgent);
		}
		/**
		* Retorna resumo gerencial com contagens, valores e fila priorizada.
		*
		* @param {Object} filters
		* @param {Object} [options={}]
		* @returns {ActionPrioritySummary}
		*/
		getActionPrioritySummary(filters = {}, options = {}) {
			const items = this.getActionPriorities(filters, options);
			return this._buildSummary(items);
		}
		_buildPriority(deal, refMs, signalMap) {
			const days = _agingDays(deal, refMs);
			const level = _classifyAging(days);
			const valor = Number(deal.valor) || 0;
			const hasAction = _hasNextAction(deal);
			const signals = signalMap.get(deal.id) || [];
			const { score, reasons, signalTypes } = this._computeScore(level, valor, signals, hasAction);
			return {
				id: `priority::${deal.id || ""}`,
				dealId: deal.id || "",
				dealName: deal.nome || deal.cliente || deal.id || "",
				company: deal.empresa || "",
				responsible: deal.responsavel || "",
				pipeline: deal.funil || "",
				stage: deal.etapa || "",
				status: deal.status || "",
				value: valor,
				agingDays: days !== null ? days : -1,
				agingLevel: level,
				priorityScore: score,
				priorityLevel: this._scoreToPriorityLevel(score),
				reasons,
				signalTypes,
				nextActionAt: deal.proximaAcao || null,
				lastRelevantAt: _lastRelevantAt(deal),
				metadata: { hasNextAction: hasAction }
			};
		}
		_computeScore(agingLevel, valor, signals, hasNextAction) {
			let score = 0;
			const reasons = [];
			const signalTypes = [];
			const agingBase = SCORE_WEIGHTS.aging[agingLevel] || 0;
			if (agingBase > 0) {
				score += agingBase;
				reasons.push(this._reasonForAging(agingLevel, agingBase));
			}
			for (const signal of signals) {
				const bonus = SCORE_WEIGHTS.signal[signal.type];
				if (bonus !== void 0) {
					score += bonus;
					reasons.push({
						code: signal.type,
						label: SIGNAL_REASON_LABELS[signal.type] || signal.type,
						weight: bonus
					});
				}
				signalTypes.push(signal.type);
			}
			const { bonus: vBonus, reason: vReason } = this._computeValueBonus(valor);
			if (vBonus > 0) {
				score += vBonus;
				reasons.push(vReason);
			}
			if ((agingLevel === "risk" || agingLevel === "critical") && !hasNextAction) {
				score += SCORE_WEIGHTS.noNextAction;
				reasons.push({
					code: "NO_NEXT_ACTION",
					label: "Sem próxima ação registrada",
					weight: SCORE_WEIGHTS.noNextAction
				});
			}
			return {
				score: Math.min(100, Math.max(0, score)),
				reasons,
				signalTypes
			};
		}
		_computeValueBonus(valor) {
			if (valor >= VALUE_THRESHOLDS.veryHigh) {
				const w = SCORE_WEIGHTS.value.veryHigh;
				return {
					bonus: w,
					reason: {
						code: "VERY_HIGH_VALUE",
						label: "Valor muito alto (≥ R$ 1 milhão)",
						weight: w
					}
				};
			}
			if (valor >= VALUE_THRESHOLDS.high) {
				const w = SCORE_WEIGHTS.value.high;
				return {
					bonus: w,
					reason: {
						code: "HIGH_VALUE",
						label: "Valor alto (≥ R$ 500 mil)",
						weight: w
					}
				};
			}
			return {
				bonus: 0,
				reason: null
			};
		}
		_reasonForAging(level, base) {
			return {
				code: `${level.toUpperCase()}_AGING`,
				label: AGING_REASON_LABELS[level] || level,
				weight: base
			};
		}
		_scoreToPriorityLevel(score) {
			if (score >= PRIORITY_SCORE_THRESHOLDS.urgent) return PRIORITY_LEVELS.urgent;
			if (score >= PRIORITY_SCORE_THRESHOLDS.high) return PRIORITY_LEVELS.high;
			if (score >= PRIORITY_SCORE_THRESHOLDS.medium) return PRIORITY_LEVELS.medium;
			return PRIORITY_LEVELS.low;
		}
		_buildDealSignalMap(signals) {
			const map = /* @__PURE__ */ new Map();
			for (const signal of signals) {
				if (signal.dealId == null) continue;
				if (!map.has(signal.dealId)) map.set(signal.dealId, []);
				map.get(signal.dealId).push(signal);
			}
			return map;
		}
		_sortPriorities(items) {
			items.sort((a, b) => {
				if (b.priorityScore !== a.priorityScore) return b.priorityScore - a.priorityScore;
				if (b.value !== a.value) return b.value - a.value;
				const ad = a.agingDays >= 0 ? a.agingDays : -1;
				const bd = b.agingDays >= 0 ? b.agingDays : -1;
				if (bd !== ad) return bd - ad;
				return String(a.dealId).localeCompare(String(b.dealId));
			});
		}
		_buildSummary(items) {
			const byPriorityLevel = {
				urgent: 0,
				high: 0,
				medium: 0,
				low: 0
			};
			let prioritizedValue = 0;
			let urgentValue = 0;
			let scoreSum = 0;
			for (const p of items) {
				if (p.priorityLevel in byPriorityLevel) byPriorityLevel[p.priorityLevel]++;
				if (p.priorityLevel === PRIORITY_LEVELS.high || p.priorityLevel === PRIORITY_LEVELS.urgent) prioritizedValue += p.value;
				if (p.priorityLevel === PRIORITY_LEVELS.urgent) urgentValue += p.value;
				scoreSum += p.priorityScore;
			}
			const averagePriorityScore = items.length > 0 ? Math.round(scoreSum / items.length) : 0;
			return {
				totalPriorities: items.length,
				urgentDeals: byPriorityLevel.urgent,
				highPriorityDeals: byPriorityLevel.high,
				mediumPriorityDeals: byPriorityLevel.medium,
				lowPriorityDeals: byPriorityLevel.low,
				prioritizedValue,
				urgentValue,
				averagePriorityScore,
				byPriorityLevel,
				priorities: items
			};
		}
		_getRiskAnalyzer() {
			if (!this._riskAnalyzer) this._riskAnalyzer = new CRMRiskSignalAnalyzer(this._readModel);
			return this._riskAnalyzer;
		}
		_referenceMs(options) {
			const r = options && options.referenceDate;
			return typeof r === "number" && r > 0 ? r : Date.now();
		}
		_requireReadModel() {
			if (!this._readModel || typeof this._readModel.getDeals !== "function") throw new TypeError("[CRMActionPriorityAnalyzer] readModel must expose getDeals()");
		}
	};
	//#endregion
	//#region ../../../queries/crm/crm-management-brief-builder.js
	/**
	* ESA OS — Queries / CRM
	* CRMManagementBriefBuilder
	*
	* Orquestra os resultados do CRMQueryService em um briefing gerencial consolidado.
	* NÃO recalcula análises — consolida contratos existentes via dependency injection.
	*
	* Seções consolidadas:
	*   executive      → getExecutiveSummary()
	*   pipelineHealth → getPipelineHealth()
	*   risk           → getRiskSignalSummary()
	*   actionPriority → getActionPrioritySummary()
	*
	* Gera highlights gerenciais determinísticos e narrativa em pt-BR.
	* Cada seção é isolada: falha de uma seção não impede as demais.
	*
	* IMPORTANTE:
	* Não acessa Firebase. Não acessa Event Bus. Não usa IA.
	* Não duplica CRMPipelineAnalyzer, CRMRiskSignalAnalyzer, CRMActionPriorityAnalyzer.
	* Usa dependency injection — recebe CRMQueryService no constructor.
	*/
	/** Threshold de exposição financeira elevada para highlight HIGH_EXPOSURE (R$ 1.000.000). */
	var HIGH_EXPOSURE_THRESHOLD = 1e6;
	/** Status de seção no briefing (centralizados). */
	var SECTION_STATUS = {
		available: "available",
		unavailable: "unavailable"
	};
	/** Códigos de highlight (centralizados — sem strings mágicas). */
	var HIGHLIGHT_CODES = {
		CRITICAL_PIPELINE: "CRITICAL_PIPELINE",
		VALUE_AT_RISK: "VALUE_AT_RISK",
		NO_NEXT_ACTION: "NO_NEXT_ACTION",
		CRITICAL_SIGNALS: "CRITICAL_SIGNALS",
		URGENT_ACTIONS: "URGENT_ACTIONS",
		HIGH_EXPOSURE: "HIGH_EXPOSURE"
	};
	/** Severidade dos highlights (alinhada com SEVERITY_LEVELS do CRMRiskSignalAnalyzer). */
	var HIGHLIGHT_SEVERITY = {
		critical: "critical",
		risk: "risk",
		attention: "attention",
		info: "info"
	};
	var SEVERITY_ORDER = {
		critical: 0,
		risk: 1,
		attention: 2,
		info: 3
	};
	var TOP_SIGNALS_LIMIT = 10;
	var TOP_PRIORITIES_LIMIT = 10;
	/**
	* Builder do briefing gerencial comercial da ESA OS.
	* Não recalcula análises — orquestra CRMQueryService.
	*/
	var CRMManagementBriefBuilder = class {
		/** @param {CRMQueryService} queryService */
		constructor(queryService) {
			this._qs = queryService;
		}
		/**
		* Constrói o briefing gerencial consolidado.
		*
		* @param {Object} [filters={}]
		* @param {Object} [options={}]
		* @param {number} [options.referenceDate] - Timestamp ms (testes determinísticos)
		* @returns {ManagementBrief}
		*/
		buildBrief(filters = {}, options = {}) {
			const refDate = this._refDate(options);
			const sections = {};
			const available = [];
			const unavail = [];
			let executive = null;
			let pipelineHealth = null;
			let risk = null;
			let actionPriority = null;
			try {
				executive = this._normalizeExecutive(this._qs.getExecutiveSummary(filters).toJSON());
				sections.executive = SECTION_STATUS.available;
				available.push("executive");
			} catch (_) {
				sections.executive = SECTION_STATUS.unavailable;
				unavail.push("executive");
			}
			try {
				pipelineHealth = this._normalizePipelineHealth(this._qs.getPipelineHealth(filters, options).toJSON());
				sections.pipelineHealth = SECTION_STATUS.available;
				available.push("pipelineHealth");
			} catch (_) {
				sections.pipelineHealth = SECTION_STATUS.unavailable;
				unavail.push("pipelineHealth");
			}
			try {
				risk = this._normalizeRisk(this._qs.getRiskSignalSummary(filters, options).toJSON());
				sections.risk = SECTION_STATUS.available;
				available.push("risk");
			} catch (_) {
				sections.risk = SECTION_STATUS.unavailable;
				unavail.push("risk");
			}
			try {
				actionPriority = this._normalizeActionPriority(this._qs.getActionPrioritySummary(filters, options).toJSON());
				sections.actionPriority = SECTION_STATUS.available;
				available.push("actionPriority");
			} catch (_) {
				sections.actionPriority = SECTION_STATUS.unavailable;
				unavail.push("actionPriority");
			}
			const highlights = this._buildHighlights(pipelineHealth, risk, actionPriority);
			this._sortHighlights(highlights);
			const managementNarrative = this._buildNarrative(pipelineHealth, risk, actionPriority, executive);
			return {
				generatedAt: Date.now(),
				referenceDate: refDate,
				filters: Object.assign({}, filters),
				executive,
				pipelineHealth,
				risk,
				actionPriority,
				highlights,
				managementNarrative,
				metadata: {
					filtersApplied: Object.keys(filters).length > 0,
					referenceDate: refDate,
					sections,
					availableSections: available.slice(),
					unavailableSections: unavail.slice(),
					highlightCount: highlights.length,
					topRiskSignalCount: risk ? risk.topSignals.length : 0,
					topPriorityCount: actionPriority ? actionPriority.topPriorities.length : 0
				}
			};
		}
		_normalizeExecutive(json) {
			const d = json.data || {};
			const meta = json.metadata || {};
			return {
				totalDeals: meta.dealCount !== void 0 && meta.dealCount !== null ? meta.dealCount : d.status && d.status.total || 0,
				conversionRate: Number(d.conversion && d.conversion.rate || 0),
				winRate: Number(d.winRate && d.winRate.rate || 0),
				lossRate: Number(d.lossRate && d.lossRate.rate || 0),
				pausedRate: Number(d.pausedRate && d.pausedRate.rate || 0),
				pipelineValue: Number(d.forecast && d.forecast.totalValue || 0),
				weightedForecast: Number(d.forecast && d.forecast.weightedValue || 0)
			};
		}
		_normalizePipelineHealth(json) {
			const d = json.data || {};
			return {
				totalDeals: Number(d.totalDeals) || 0,
				freshDeals: Number(d.freshDeals) || 0,
				attentionDeals: Number(d.attentionDeals) || 0,
				riskDeals: Number(d.riskDeals) || 0,
				criticalDeals: Number(d.criticalDeals) || 0,
				dealsWithoutNextAction: Number(d.dealsWithoutNextAction) || 0,
				valueAtRisk: Number(d.valueAtRisk) || 0,
				criticalValue: Number(d.criticalValue) || 0,
				agingDistribution: Object.assign({}, d.agingDistribution || {})
			};
		}
		_normalizeRisk(json) {
			const d = json.data || {};
			const signals = Array.isArray(d.signals) ? d.signals : [];
			return {
				totalSignals: Number(d.totalSignals) || 0,
				criticalSignals: Number(d.criticalSignals) || 0,
				riskSignals: Number(d.riskSignals) || 0,
				affectedDeals: Number(d.affectedDeals) || 0,
				valueExposed: Number(d.valueExposed) || 0,
				byType: Object.assign({}, d.byType || {}),
				bySeverity: Object.assign({}, d.bySeverity || {}),
				topSignals: signals.slice(0, TOP_SIGNALS_LIMIT)
			};
		}
		_normalizeActionPriority(json) {
			const d = json.data || {};
			const priorities = Array.isArray(d.priorities) ? d.priorities : [];
			return {
				totalPriorities: Number(d.totalPriorities) || 0,
				urgentDeals: Number(d.urgentDeals) || 0,
				highPriorityDeals: Number(d.highPriorityDeals) || 0,
				mediumPriorityDeals: Number(d.mediumPriorityDeals) || 0,
				lowPriorityDeals: Number(d.lowPriorityDeals) || 0,
				prioritizedValue: Number(d.prioritizedValue) || 0,
				urgentValue: Number(d.urgentValue) || 0,
				averagePriorityScore: Number(d.averagePriorityScore) || 0,
				byPriorityLevel: Object.assign({}, d.byPriorityLevel || {}),
				topPriorities: priorities.slice(0, TOP_PRIORITIES_LIMIT)
			};
		}
		_buildHighlights(ph, risk, ap) {
			const h = [];
			if (ph) {
				if (ph.criticalDeals > 0) {
					const n = ph.criticalDeals;
					h.push(this._mkHighlight(HIGHLIGHT_CODES.CRITICAL_PIPELINE, HIGHLIGHT_SEVERITY.critical, "Deals críticos no pipeline", `${n} deal${n !== 1 ? "s" : ""} com aging superior a 30 dias exige${n === 1 ? "" : "m"} ação imediata.`, ph.criticalValue > 0 ? ph.criticalValue : null, n, null, {
						criticalDeals: n,
						criticalValue: ph.criticalValue
					}));
				}
				if (ph.valueAtRisk > 0) {
					const n = ph.riskDeals + ph.criticalDeals;
					h.push(this._mkHighlight(HIGHLIGHT_CODES.VALUE_AT_RISK, HIGHLIGHT_SEVERITY.risk, "Valor em risco no pipeline", `${_fmtCurrency(ph.valueAtRisk)} em valor concentra-se em deals com aging elevado.`, ph.valueAtRisk, n > 0 ? n : null, null, { valueAtRisk: ph.valueAtRisk }));
				}
				if (ph.dealsWithoutNextAction > 0) {
					const n = ph.dealsWithoutNextAction;
					h.push(this._mkHighlight(HIGHLIGHT_CODES.NO_NEXT_ACTION, HIGHLIGHT_SEVERITY.attention, "Deals sem próxima ação", `${n} deal${n !== 1 ? "s" : ""} não possui${n === 1 ? "" : "em"} próxima ação registrada.`, null, n, null, { dealsWithoutNextAction: n }));
				}
			}
			if (risk) {
				if (risk.criticalSignals > 0) {
					const n = risk.criticalSignals;
					h.push(this._mkHighlight(HIGHLIGHT_CODES.CRITICAL_SIGNALS, HIGHLIGHT_SEVERITY.critical, "Sinais críticos de risco", `${n} sinal${n !== 1 ? "ais" : ""} de risco em nível crítico ${n === 1 ? "foi" : "foram"} identificado${n !== 1 ? "s" : ""}.`, risk.valueExposed > 0 ? risk.valueExposed : null, n, null, {
						criticalSignals: n,
						valueExposed: risk.valueExposed
					}));
				}
				if (risk.valueExposed >= 1e6) h.push(this._mkHighlight(HIGHLIGHT_CODES.HIGH_EXPOSURE, HIGHLIGHT_SEVERITY.risk, "Alta exposição financeira a risco", `${_fmtCurrency(risk.valueExposed)} em valor está exposto a sinais de risco comercial.`, risk.valueExposed, risk.affectedDeals > 0 ? risk.affectedDeals : null, null, {
					valueExposed: risk.valueExposed,
					threshold: HIGH_EXPOSURE_THRESHOLD
				}));
			}
			if (ap && ap.urgentDeals > 0) {
				const n = ap.urgentDeals;
				h.push(this._mkHighlight(HIGHLIGHT_CODES.URGENT_ACTIONS, HIGHLIGHT_SEVERITY.critical, "Ações urgentes pendentes", `${n} deal${n !== 1 ? "s" : ""} com prioridade urgente exige${n === 1 ? "" : "m"} ação imediata.`, ap.urgentValue > 0 ? ap.urgentValue : null, n, null, {
					urgentDeals: n,
					urgentValue: ap.urgentValue
				}));
			}
			return h;
		}
		_mkHighlight(code, severity, title, description, value, count, dealId, metadata) {
			return {
				code,
				severity,
				title: String(title || ""),
				description: String(description || ""),
				value: typeof value === "number" && !isNaN(value) ? value : null,
				count: typeof count === "number" && !isNaN(count) ? count : null,
				dealId: dealId != null ? String(dealId) : null,
				metadata: Object.assign({}, metadata || {})
			};
		}
		_sortHighlights(items) {
			items.sort((a, b) => {
				const sd = (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99);
				if (sd !== 0) return sd;
				const va = a.value ?? -1;
				const vb = b.value ?? -1;
				if (vb !== va) return vb - va;
				const ca = a.count ?? -1;
				const cb = b.count ?? -1;
				if (cb !== ca) return cb - ca;
				return String(a.code).localeCompare(String(b.code));
			});
		}
		_buildNarrative(ph, risk, ap, executive) {
			const parts = [];
			if (ph && ph.criticalDeals > 0) {
				const n = ph.criticalDeals;
				const suffix = ph.valueAtRisk > 0 ? ` e ${_fmtCurrency(ph.valueAtRisk)} em valor sob risco` : "";
				parts.push(`O pipeline possui ${n} deal${n !== 1 ? "s" : ""} crítico${n !== 1 ? "s" : ""}${suffix}.`);
			}
			if (risk && risk.criticalSignals > 0) {
				const n = risk.criticalSignals;
				parts.push(`Foram identificados ${n} sinal${n !== 1 ? "ais" : ""} crítico${n !== 1 ? "s" : ""} de risco comercial.`);
			}
			if (ap && ap.urgentDeals > 0) {
				const n = ap.urgentDeals;
				parts.push(`${n} deal${n !== 1 ? "s" : ""} exige${n === 1 ? "" : "m"} atenção urgente.`);
			}
			if (ph && ph.dealsWithoutNextAction > 0) {
				const n = ph.dealsWithoutNextAction;
				parts.push(`A principal prioridade gerencial é reduzir o volume de oportunidades sem próxima ação (${n} deal${n !== 1 ? "s" : ""}).`);
			}
			if (parts.length === 0) if (executive && executive.weightedForecast > 0) parts.push(`O forecast ponderado do pipeline é de ${_fmtCurrency(executive.weightedForecast)}.`);
			else if (executive && executive.pipelineValue > 0) parts.push(`O pipeline acumula ${_fmtCurrency(executive.pipelineValue)} em valor total.`);
			else parts.push("Nenhuma anomalia gerencial identificada no pipeline atual.");
			return parts.join(" ");
		}
		_refDate(options) {
			const r = options && options.referenceDate;
			return typeof r === "number" && r > 0 ? r : null;
		}
	};
	function _fmtCurrency(value) {
		if (typeof value !== "number" || isNaN(value)) return "R$\xA00";
		return new Intl.NumberFormat("pt-BR", {
			style: "currency",
			currency: "BRL",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(value);
	}
	//#endregion
	//#region ../../../queries/crm/crm-query-service.js
	/**
	* ESA OS — Queries / CRM
	* CRMQueryService
	*
	* Camada somente leitura para consultas gerenciais do CRM.
	* Centraliza acesso ao CRMReadModel e CRMMetrics para UI, Solana IA, APIs e relatórios.
	*
	* Padrão: Query Service (CQRS)
	*
	* IMPORTANTE:
	* Não acessa Firebase. Não acessa Audit. Não acessa Logger. Não acessa Event Bus.
	* Usa dependency injection — não importa singletons diretamente.
	* Valida dependências no momento da execução da query, não no constructor.
	*/
	var CRMQueryService = class {
		/**
		* @param {CRMReadModel} readModel - Instância do Read Model CRM (injetada)
		* @param {CRMMetrics}   metrics   - Instância de métricas CRM (injetada)
		*/
		constructor(readModel, metrics) {
			this._readModel = readModel;
			this._metrics = metrics;
			this._pipelineAnalyzer = null;
			this._riskAnalyzer = null;
			this._actionPriorityAnalyzer = null;
			this._briefBuilder = null;
		}
		/**
		* Retorna um Deal pelo ID.
		* Não valida metrics — esta query não as utiliza.
		*
		* @param {string} dealId
		* @returns {CRMQueryResult} data: Deal | null
		*/
		getDeal(dealId) {
			this._requireReadModel("getDeal");
			return new CRMQueryResult(this._readModel.getDeal(dealId), {
				query: "crm.getDeal",
				dealId
			});
		}
		/**
		* Busca Deals com filtros opcionais.
		*
		* @param {Object} filters - Filtros aceitos por CRMReadModel.getDeals()
		* @returns {CRMQueryResult} data: Deal[]
		*/
		searchDeals(filters = {}) {
			this._requireReadModel("getDeals");
			const deals = this._readModel.getDeals(filters);
			return new CRMQueryResult(deals, {
				query: "crm.searchDeals",
				filters: Object.assign({}, filters),
				count: deals.length
			});
		}
		/**
		* Retorna pipeline agrupado por funil → etapa.
		*
		* @param {Object} filters
		* @returns {CRMQueryResult} data: pipeline
		*/
		getPipeline(filters = {}) {
			this._requireReadModel("getPipeline");
			return new CRMQueryResult(this._readModel.getPipeline(filters), {
				query: "crm.getPipeline",
				filters: Object.assign({}, filters)
			});
		}
		/**
		* Retorna contagem de Deals por status.
		*
		* @param {Object} filters
		* @returns {CRMQueryResult} data: { total, byStatus }
		*/
		getStatusSummary(filters = {}) {
			this._requireReadModel("getStatusSummary");
			return new CRMQueryResult(this._readModel.getStatusSummary(filters), {
				query: "crm.getStatusSummary",
				filters: Object.assign({}, filters)
			});
		}
		/**
		* Retorna métricas de conversão, win/loss/paused rate.
		* Não inclui forecast — use getForecast() separadamente.
		*
		* @param {Object} filters
		* @returns {CRMQueryResult} data: { conversion, winRate, lossRate, pausedRate }
		*/
		getMetrics(filters = {}) {
			this._requireMetrics("getConversionRate");
			this._requireMetrics("getWinRate");
			this._requireMetrics("getLossRate");
			this._requireMetrics("getPausedRate");
			return new CRMQueryResult({
				conversion: this._metrics.getConversionRate(filters),
				winRate: this._metrics.getWinRate(filters),
				lossRate: this._metrics.getLossRate(filters),
				pausedRate: this._metrics.getPausedRate(filters)
			}, {
				query: "crm.getMetrics",
				filters: Object.assign({}, filters)
			});
		}
		/**
		* Retorna forecast ponderado por status.
		*
		* @param {Object} filters
		* @returns {CRMQueryResult} data: { totalValue, weightedValue, dealCount, byStatus }
		*/
		getForecast(filters = {}) {
			this._requireMetrics("getForecast");
			return new CRMQueryResult(this._metrics.getForecast(filters), {
				query: "crm.getForecast",
				filters: Object.assign({}, filters)
			});
		}
		/**
		* Consolida pipeline, status e todas as métricas em uma única resposta.
		* Projetado para Dashboard executivo, Solana IA e relatórios gerenciais.
		*
		* @param {Object} filters
		* @returns {CRMQueryResult} data: { pipeline, status, conversion, winRate, lossRate, pausedRate, forecast }
		*/
		getExecutiveSummary(filters = {}) {
			this._requireReadModel("getPipeline");
			this._requireReadModel("getStatusSummary");
			this._requireReadModel("getDeals");
			this._requireMetrics("getConversionRate");
			this._requireMetrics("getWinRate");
			this._requireMetrics("getLossRate");
			this._requireMetrics("getPausedRate");
			this._requireMetrics("getForecast");
			const dealCount = this._readModel.getDeals(filters).length;
			return new CRMQueryResult({
				pipeline: this._readModel.getPipeline(filters),
				status: this._readModel.getStatusSummary(filters),
				conversion: this._metrics.getConversionRate(filters),
				winRate: this._metrics.getWinRate(filters),
				lossRate: this._metrics.getLossRate(filters),
				pausedRate: this._metrics.getPausedRate(filters),
				forecast: this._metrics.getForecast(filters)
			}, {
				query: "crm.getExecutiveSummary",
				filters: Object.assign({}, filters),
				dealCount
			});
		}
		/**
		* Retorna resumo de saúde do pipeline com distribuição de aging e valores em risco.
		*
		* @param {Object} filters
		* @param {Object} [options={}]
		* @returns {CRMQueryResult} data: PipelineHealth
		*/
		getPipelineHealth(filters = {}, options = {}) {
			this._requireReadModel("getDeals");
			return new CRMQueryResult(this._getAnalyzer().getPipelineHealth(filters, options), {
				query: "crm.getPipelineHealth",
				filters: Object.assign({}, filters)
			});
		}
		/**
		* Retorna lista gerencial de deals críticos (aging > 30 dias).
		*
		* @param {Object} filters
		* @param {Object} [options={}]
		* @returns {CRMQueryResult} data: DealItem[]
		*/
		getCriticalDeals(filters = {}, options = {}) {
			this._requireReadModel("getDeals");
			const items = this._getAnalyzer().getCriticalDeals(filters, options);
			return new CRMQueryResult(items, {
				query: "crm.getCriticalDeals",
				filters: Object.assign({}, filters),
				count: items.length
			});
		}
		/**
		* Retorna lista gerencial de deals sem próxima ação registrada.
		*
		* @param {Object} filters
		* @param {Object} [options={}]
		* @returns {CRMQueryResult} data: DealItem[]
		*/
		getDealsWithoutNextAction(filters = {}, options = {}) {
			this._requireReadModel("getDeals");
			const items = this._getAnalyzer().getDealsWithoutNextAction(filters, options);
			return new CRMQueryResult(items, {
				query: "crm.getDealsWithoutNextAction",
				filters: Object.assign({}, filters),
				count: items.length
			});
		}
		/**
		* Retorna lista priorizada de sinais de risco comercial.
		*
		* @param {Object} filters
		* @param {Object} [options={}]
		* @returns {CRMQueryResult} data: RiskSignal[]
		*/
		getRiskSignals(filters = {}, options = {}) {
			this._requireReadModel("getDeals");
			const signals = this._getRiskAnalyzer().getRiskSignals(filters, options);
			return new CRMQueryResult(signals, {
				query: "crm.getRiskSignals",
				filters: Object.assign({}, filters),
				count: signals.length
			});
		}
		/**
		* Retorna apenas sinais com severity === 'critical'.
		*
		* @param {Object} filters
		* @param {Object} [options={}]
		* @returns {CRMQueryResult} data: RiskSignal[]
		*/
		getCriticalRiskSignals(filters = {}, options = {}) {
			this._requireReadModel("getDeals");
			const signals = this._getRiskAnalyzer().getCriticalRiskSignals(filters, options);
			return new CRMQueryResult(signals, {
				query: "crm.getCriticalRiskSignals",
				filters: Object.assign({}, filters),
				count: signals.length
			});
		}
		/**
		* Retorna resumo gerencial com contagens, valor exposto e lista priorizada de sinais.
		*
		* @param {Object} filters
		* @param {Object} [options={}]
		* @returns {CRMQueryResult} data: RiskSignalSummary
		*/
		getRiskSignalSummary(filters = {}, options = {}) {
			this._requireReadModel("getDeals");
			return new CRMQueryResult(this._getRiskAnalyzer().getRiskSignalSummary(filters, options), {
				query: "crm.getRiskSignalSummary",
				filters: Object.assign({}, filters)
			});
		}
		/**
		* Retorna lista priorizada de ações comerciais por deal.
		*
		* @param {Object} filters
		* @param {Object} [options={}]
		* @returns {CRMQueryResult} data: ActionPriority[]
		*/
		getActionPriorities(filters = {}, options = {}) {
			this._requireReadModel("getDeals");
			const items = this._getActionPriorityAnalyzer().getActionPriorities(filters, options);
			return new CRMQueryResult(items, {
				query: "crm.getActionPriorities",
				filters: Object.assign({}, filters),
				count: items.length
			});
		}
		/**
		* Retorna apenas prioridades com nível 'urgent'.
		*
		* @param {Object} filters
		* @param {Object} [options={}]
		* @returns {CRMQueryResult} data: ActionPriority[]
		*/
		getUrgentActionPriorities(filters = {}, options = {}) {
			this._requireReadModel("getDeals");
			const items = this._getActionPriorityAnalyzer().getUrgentActionPriorities(filters, options);
			return new CRMQueryResult(items, {
				query: "crm.getUrgentActionPriorities",
				filters: Object.assign({}, filters),
				count: items.length
			});
		}
		/**
		* Retorna resumo gerencial de prioridades de ação com contagens e fila.
		*
		* @param {Object} filters
		* @param {Object} [options={}]
		* @returns {CRMQueryResult} data: ActionPrioritySummary
		*/
		getActionPrioritySummary(filters = {}, options = {}) {
			this._requireReadModel("getDeals");
			return new CRMQueryResult(this._getActionPriorityAnalyzer().getActionPrioritySummary(filters, options), {
				query: "crm.getActionPrioritySummary",
				filters: Object.assign({}, filters)
			});
		}
		/**
		* Constrói o briefing gerencial consolidado.
		* Orquestra Executive Summary, Pipeline Health, Risk Signals e Action Priority.
		* Seções com falha ficam null — o brief sempre retorna estrutura completa.
		*
		* @param {Object} [filters={}]
		* @param {Object} [options={}]
		* @returns {CRMQueryResult} data: ManagementBrief
		*/
		getManagementBrief(filters = {}, options = {}) {
			this._requireReadModel("getDeals");
			return new CRMQueryResult(this._getBriefBuilder().buildBrief(filters, options), {
				query: "crm.getManagementBrief",
				filters: Object.assign({}, filters)
			});
		}
		_getAnalyzer() {
			if (!this._pipelineAnalyzer) this._pipelineAnalyzer = new CRMPipelineAnalyzer(this._readModel);
			return this._pipelineAnalyzer;
		}
		_getRiskAnalyzer() {
			if (!this._riskAnalyzer) this._riskAnalyzer = new CRMRiskSignalAnalyzer(this._readModel);
			return this._riskAnalyzer;
		}
		_getActionPriorityAnalyzer() {
			if (!this._actionPriorityAnalyzer) this._actionPriorityAnalyzer = new CRMActionPriorityAnalyzer(this._readModel);
			return this._actionPriorityAnalyzer;
		}
		_getBriefBuilder() {
			if (!this._briefBuilder) this._briefBuilder = new CRMManagementBriefBuilder(this);
			return this._briefBuilder;
		}
		_requireReadModel(method) {
			if (!this._readModel || typeof this._readModel[method] !== "function") throw new TypeError(`[CRMQueryService] readModel must expose ${method}()`);
		}
		_requireMetrics(method) {
			if (!this._metrics || typeof this._metrics[method] !== "function") throw new TypeError(`[CRMQueryService] metrics must expose ${method}()`);
		}
	};
	//#endregion
	//#region ../../../queries/crm/index.js
	/**
	* Singleton do CRM Query Service da plataforma ESA OS.
	* Usa os singletons crmReadModel e crmMetrics como fonte.
	* @type {CRMQueryService}
	*/
	var crmQueryService = new CRMQueryService(crmReadModel, crmMetrics);
	/** Tipo de contexto — identifica a natureza do contrato para o consumidor. */
	var CONTEXT_TYPE = "commercial-management";
	/** O que um consumidor PODE fazer com os dados deste contexto. */
	var CAPABILITIES = Object.freeze([
		"summarize",
		"explain-risk",
		"compare-priorities",
		"identify-attention-points"
	]);
	/** O que um consumidor NÃO PODE fazer com os dados deste contexto. */
	var RESTRICTIONS = Object.freeze([
		"read-only",
		"no-deal-mutation",
		"no-followup-creation",
		"no-stage-move",
		"no-user-management",
		"no-file-access",
		"no-secret-access"
	]);
	/**
	* Builder do contexto comercial para agentes Solana.
	* Não recalcula análises — delega a queryProvider.getManagementBrief().
	*/
	var SolanaCommercialContextBuilder = class {
		/** @param {Object} queryProvider - Deve expor getManagementBrief(filters, options) */
		constructor(queryProvider) {
			this._qp = queryProvider;
		}
		/**
		* Gera o contexto comercial para agentes.
		*
		* @param {Object} [filters={}]
		* @param {Object} [options={}]
		* @param {number} [options.referenceDate] - Timestamp ms (determinismo em testes)
		* @returns {SolanaCommercialContext}
		*/
		generateContext(filters = {}, options = {}) {
			if (!this._qp || typeof this._qp.getManagementBrief !== "function") throw new TypeError("[SolanaCommercialContextBuilder] queryProvider must expose getManagementBrief()");
			const result = this._qp.getManagementBrief(filters, options);
			const brief = result && typeof result.toJSON === "function" ? result.toJSON().data : result && result.data !== void 0 ? result.data : result;
			if (!brief || typeof brief !== "object") throw new Error("[SolanaCommercialContextBuilder] getManagementBrief retornou resultado inválido");
			const highlights = this._buildHighlights(brief.highlights);
			const riskSnapshot = this._buildRiskSnapshot(brief.risk);
			const actionSnapshot = this._buildActionSnapshot(brief.actionPriority);
			const entities = this._buildEntities(brief.risk, brief.actionPriority, highlights);
			return _sanitize$1({
				contextVersion: "1.0",
				contextType: CONTEXT_TYPE,
				generatedAt: _safeNum(brief.generatedAt),
				referenceDate: _safeNum(brief.referenceDate),
				scope: this._buildScope(brief.filters, filters),
				executiveSnapshot: this._buildExecutiveSnapshot(brief.executive),
				pipelineSnapshot: this._buildPipelineSnapshot(brief.pipelineHealth),
				riskSnapshot,
				actionSnapshot,
				highlights,
				narrative: typeof brief.managementNarrative === "string" ? brief.managementNarrative : null,
				entities,
				capabilities: CAPABILITIES.slice(),
				restrictions: RESTRICTIONS.slice(),
				metadata: this._buildMetadata(brief.metadata || {}, entities, highlights, riskSnapshot, actionSnapshot)
			});
		}
		_buildScope(briefFilters, callFilters) {
			return {
				organization: "esa",
				domain: "crm",
				filtersApplied: Object.assign({}, briefFilters || {}, callFilters || {})
			};
		}
		_buildExecutiveSnapshot(ex) {
			if (!ex || typeof ex !== "object") return null;
			return {
				totalDeals: _safeNum(ex.totalDeals),
				conversionRate: _safeNum(ex.conversionRate),
				winRate: _safeNum(ex.winRate),
				lossRate: _safeNum(ex.lossRate),
				pausedRate: _safeNum(ex.pausedRate),
				pipelineValue: _safeNum(ex.pipelineValue),
				weightedForecast: _safeNum(ex.weightedForecast)
			};
		}
		_buildPipelineSnapshot(ph) {
			if (!ph || typeof ph !== "object") return null;
			return {
				totalDeals: _safeNum(ph.totalDeals),
				freshDeals: _safeNum(ph.freshDeals),
				attentionDeals: _safeNum(ph.attentionDeals),
				riskDeals: _safeNum(ph.riskDeals),
				criticalDeals: _safeNum(ph.criticalDeals),
				dealsWithoutNextAction: _safeNum(ph.dealsWithoutNextAction),
				valueAtRisk: _safeNum(ph.valueAtRisk),
				criticalValue: _safeNum(ph.criticalValue),
				agingDistribution: _safePlainObject(ph.agingDistribution)
			};
		}
		_buildRiskSnapshot(risk) {
			if (!risk || typeof risk !== "object") return null;
			const top = Array.isArray(risk.topSignals) ? risk.topSignals : [];
			return {
				totalSignals: _safeNum(risk.totalSignals),
				criticalSignals: _safeNum(risk.criticalSignals),
				riskSignals: _safeNum(risk.riskSignals),
				affectedDeals: _safeNum(risk.affectedDeals),
				valueExposed: _safeNum(risk.valueExposed),
				byType: _safePlainObject(risk.byType),
				bySeverity: _safePlainObject(risk.bySeverity),
				topSignals: top.map(_normalizeSignal)
			};
		}
		_buildActionSnapshot(ap) {
			if (!ap || typeof ap !== "object") return null;
			const top = Array.isArray(ap.topPriorities) ? ap.topPriorities : [];
			return {
				totalPriorities: _safeNum(ap.totalPriorities),
				urgentDeals: _safeNum(ap.urgentDeals),
				highPriorityDeals: _safeNum(ap.highPriorityDeals),
				mediumPriorityDeals: _safeNum(ap.mediumPriorityDeals),
				lowPriorityDeals: _safeNum(ap.lowPriorityDeals),
				prioritizedValue: _safeNum(ap.prioritizedValue),
				urgentValue: _safeNum(ap.urgentValue),
				averagePriorityScore: _safeNum(ap.averagePriorityScore),
				byPriorityLevel: _safePlainObject(ap.byPriorityLevel),
				topPriorities: top.map(_normalizePriority)
			};
		}
		_buildHighlights(raw) {
			if (!Array.isArray(raw)) return [];
			return raw.map((h) => ({
				code: _safeStr(h.code),
				severity: _safeStr(h.severity),
				title: _safeStr(h.title),
				description: _safeStr(h.description),
				value: _safeNum(h.value),
				count: _safeNum(h.count),
				dealId: h.dealId != null ? _safeStr(h.dealId) : null
			}));
		}
		_buildEntities(risk, ap, highlights) {
			const map = /* @__PURE__ */ new Map();
			if (risk && Array.isArray(risk.topSignals)) for (const s of risk.topSignals) {
				const did = s && _safeStr(s.dealId);
				if (!did) continue;
				_mergeEntity(map, did, _safeStr(s.dealName) || did, "risk", _safeStr(s.type));
			}
			if (ap && Array.isArray(ap.topPriorities)) for (const p of ap.topPriorities) {
				const did = p && _safeStr(p.dealId);
				if (!did) continue;
				_mergeEntity(map, did, _safeStr(p.dealName) || did, "priority", _safeStr(p.priorityLevel));
			}
			for (const h of highlights) {
				if (!h.dealId) continue;
				_mergeEntity(map, h.dealId, h.dealId, "highlight", _safeStr(h.code));
			}
			return Array.from(map.entries()).map(([id, { name, roles, references }]) => ({
				entityType: "deal",
				id,
				name,
				role: Array.from(roles).sort(),
				references: Array.from(references).filter(Boolean).sort()
			})).sort((a, b) => a.id.localeCompare(b.id));
		}
		_buildMetadata(briefMeta, entities, highlights, riskSnapshot, actionSnapshot) {
			return {
				source: "crm-management-brief",
				sourceVersion: "1.0",
				sectionsAvailable: Array.isArray(briefMeta.availableSections) ? briefMeta.availableSections.slice() : [],
				sectionsUnavailable: Array.isArray(briefMeta.unavailableSections) ? briefMeta.unavailableSections.slice() : [],
				entityCount: entities.length,
				highlightCount: highlights.length,
				riskSignalCount: riskSnapshot && Array.isArray(riskSnapshot.topSignals) ? riskSnapshot.topSignals.length : 0,
				priorityCount: actionSnapshot && Array.isArray(actionSnapshot.topPriorities) ? actionSnapshot.topPriorities.length : 0,
				minimized: true,
				readOnly: true
			};
		}
	};
	function _mergeEntity(map, id, name, role, ref) {
		if (!map.has(id)) map.set(id, {
			name: name || id,
			roles: /* @__PURE__ */ new Set(),
			references: /* @__PURE__ */ new Set()
		});
		const e = map.get(id);
		if (name && !e.name) e.name = name;
		e.roles.add(role);
		if (ref) e.references.add(ref);
	}
	function _normalizeSignal(s) {
		return {
			type: _safeStr(s.type),
			severity: _safeStr(s.severity),
			title: _safeStr(s.title),
			dealId: s.dealId != null ? _safeStr(s.dealId) : null,
			dealName: s.dealName != null ? _safeStr(s.dealName) : null,
			responsible: s.responsible != null ? _safeStr(s.responsible) : null,
			pipeline: s.pipeline != null ? _safeStr(s.pipeline) : null,
			value: _safeNum(s.value),
			agingDays: _safeNum(s.agingDays)
		};
	}
	function _normalizePriority(p) {
		const days = p.agingDays != null ? Number(p.agingDays) : null;
		return {
			dealId: _safeStr(p.dealId),
			dealName: _safeStr(p.dealName),
			responsible: _safeStr(p.responsible),
			pipeline: _safeStr(p.pipeline),
			priorityLevel: _safeStr(p.priorityLevel),
			priorityScore: _safeNum(p.priorityScore),
			value: _safeNum(p.value),
			agingDays: days !== null && !isNaN(days) && days >= 0 ? days : null
		};
	}
	function _safeStr(v) {
		if (v === null || v === void 0) return null;
		if (typeof v === "object") return null;
		return String(v);
	}
	function _safeNum(v) {
		if (v === null || v === void 0) return null;
		const n = Number(v);
		return isNaN(n) ? null : n;
	}
	function _safePlainObject(v) {
		if (!v || typeof v !== "object" || Array.isArray(v)) return {};
		const out = {};
		for (const [k, val] of Object.entries(v)) if (typeof val === "number") out[k] = isNaN(val) ? null : val;
		else if (val === null || val === void 0) out[k] = null;
		else if (typeof val === "string" || typeof val === "boolean") out[k] = val;
		else out[k] = null;
		return out;
	}
	function _sanitize$1(v) {
		if (v === void 0) return null;
		if (v === null) return null;
		if (typeof v === "number") return isNaN(v) ? null : v;
		if (Array.isArray(v)) return v.map(_sanitize$1);
		if (typeof v === "object") {
			const out = {};
			for (const [k, val] of Object.entries(v)) out[k] = _sanitize$1(val);
			return out;
		}
		return v;
	}
	//#endregion
	//#region ../../../domains/energy/credits/constants.js
	/**
	* ESA OS — Energy Domain / Credits
	* Constants
	*
	* Status enums centralizados do módulo de gestão de créditos.
	* Todos os valores são strings lowercase para consistência com o restante do ESA OS.
	*/
	var OPERATIONAL_STATUS = Object.freeze({
		ACTIVE: "active",
		INACTIVE: "inactive",
		MAINTENANCE: "maintenance",
		DECOMMISSIONED: "decommissioned"
	});
	var SUBSCRIPTION_STATUS = Object.freeze({
		ACTIVE: "active",
		SUSPENDED: "suspended",
		CANCELLED: "cancelled",
		PENDING: "pending"
	});
	var PAYMENT_STATUS = Object.freeze({
		PENDING: "pending",
		PAID: "paid",
		OVERDUE: "overdue",
		CANCELLED: "cancelled",
		PARTIAL: "partial"
	});
	var STATEMENT_STATUS = Object.freeze({
		OPEN: "open",
		REVIEW: "review",
		CLOSED: "closed",
		PAID: "paid",
		CANCELLED: "cancelled"
	});
	Object.freeze({
		PENDING: "pending",
		CONFIRMED: "confirmed",
		PARTIALLY_COMPENSATED: "partially_compensated",
		COMPENSATED: "compensated",
		CANCELLED: "cancelled"
	});
	//#endregion
	//#region ../../../domains/energy/credits/alert.js
	/**
	* ESA OS — Energy Domain / Credits
	* Alerts
	*
	* Contrato de alertas calculados na apuração mensal.
	* Alertas são observações geradas automaticamente — não bloqueiam o cálculo.
	* Erros que bloqueiam o cálculo são retornados como EnergyCreditsResult.errors.
	*/
	var ALERT_CODE = Object.freeze({
		INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",
		NEGATIVE_SAVINGS: "NEGATIVE_SAVINGS",
		OVER_ALLOCATION_BLOCKED: "OVER_ALLOCATION_BLOCKED",
		PENDING_COMPENSATION: "PENDING_COMPENSATION",
		NO_BENEFICIARIES: "NO_BENEFICIARIES",
		ZERO_GENERATION: "ZERO_GENERATION",
		ZERO_CONSUMPTION: "ZERO_CONSUMPTION",
		MISSING_PRICE: "MISSING_PRICE",
		MISSING_TARIFF: "MISSING_TARIFF",
		HIGH_BENEFICIARY_CREDIT_BALANCE: "HIGH_BENEFICIARY_CREDIT_BALANCE",
		LOW_BENEFICIARY_CREDIT_BALANCE: "LOW_BENEFICIARY_CREDIT_BALANCE",
		ALLOCATION_PERCENTAGE_TOTAL_INVALID: "ALLOCATION_PERCENTAGE_TOTAL_INVALID",
		CONSUMPTION_ABOVE_AVERAGE: "CONSUMPTION_ABOVE_AVERAGE"
	});
	var ALERT_SEVERITY = Object.freeze({
		INFO: "info",
		ATTENTION: "attention",
		RISK: "risk",
		CRITICAL: "critical"
	});
	/**
	* Cria um alerta padronizado.
	*
	* @param {string} code       - ALERT_CODE.*
	* @param {string} severity   - ALERT_SEVERITY.*
	* @param {string} message    - Descrição legível
	* @param {string} targetType - Tipo da entidade afetada ('generatingUnit' | 'beneficiaryUnit')
	* @param {string} targetId   - ID da entidade afetada
	* @param {Object} [metadata] - Dados extras do alerta
	* @returns {{ code, severity, message, targetType, targetId, metadata }}
	*/
	function createAlert(code, severity, message, targetType, targetId, metadata = {}) {
		return {
			code,
			severity,
			message,
			targetType,
			targetId,
			metadata
		};
	}
	//#endregion
	//#region ../../../domains/energy/credits/rounding.js
	/**
	* ESA OS — Energy Domain / Credits
	* Rounding Helpers
	*
	* Política centralizada de arredondamento:
	*   kWh  → 3 casas decimais
	*   R$   → 2 casas decimais
	*
	* Lança TypeError para valores inválidos — erro de programação, não de negócio.
	*/
	function roundKwh(value) {
		if (typeof value !== "number" || isNaN(value)) throw new TypeError(`roundKwh: valor inválido recebido: ${value}`);
		return Math.round(value * 1e3) / 1e3;
	}
	function roundMoney(value) {
		if (typeof value !== "number" || isNaN(value)) throw new TypeError(`roundMoney: valor inválido recebido: ${value}`);
		return Math.round(value * 100) / 100;
	}
	//#endregion
	//#region ../../../domains/energy/credits/result.js
	/**
	* ESA OS — Energy Domain / Credits
	* EnergyCreditsResult
	*
	* Contrato de resultado consistente para todas as operações do módulo.
	* Nunca lança exceção para erros de negócio — retorna ok:false com errors[].
	* Exceções são reservadas para erros de programação (TypeError, etc.).
	*
	* Estrutura ok:
	*   { ok: true, data, errors: [], warnings: [], metadata: {} }
	*
	* Estrutura fail:
	*   { ok: false, data: null, errors: [{ code, message, field, metadata }], warnings: [], metadata: {} }
	*/
	var EnergyCreditsResult = class {
		/**
		* @param {*}       data
		* @param {Array}   [warnings]
		* @param {Object}  [metadata]
		* @returns {{ ok: true, data, errors: [], warnings, metadata }}
		*/
		static ok(data, warnings = [], metadata = {}) {
			return {
				ok: true,
				data,
				errors: [],
				warnings,
				metadata
			};
		}
		/**
		* @param {Array|Object} errors    - Um erro ou array de erros
		* @param {Array}        [warnings]
		* @param {Object}       [metadata]
		* @returns {{ ok: false, data: null, errors, warnings, metadata }}
		*/
		static fail(errors, warnings = [], metadata = {}) {
			return {
				ok: false,
				data: null,
				errors: Array.isArray(errors) ? errors : [errors],
				warnings,
				metadata
			};
		}
		/**
		* Cria um objeto de erro padronizado para uso em errors[].
		*
		* @param {string} code
		* @param {string} message
		* @param {string|null} [field]
		* @param {Object}      [metadata]
		* @returns {{ code, message, field, metadata }}
		*/
		static makeError(code, message, field = null, metadata = {}) {
			return {
				code,
				message,
				field,
				metadata
			};
		}
		/**
		* Cria um objeto de warning padronizado para uso em warnings[].
		*
		* @param {string} code
		* @param {string} message
		* @param {string|null} [field]
		* @param {Object}      [metadata]
		* @returns {{ code, message, field, metadata }}
		*/
		static makeWarning(code, message, field = null, metadata = {}) {
			return {
				code,
				message,
				field,
				metadata
			};
		}
	};
	//#endregion
	//#region ../../../domains/energy/credits/calculator.js
	/**
	* ESA OS — Energy Domain / Credits
	* EnergyCreditsCalculator
	*
	* Fórmulas puras de cálculo do módulo de créditos.
	* Sem estado. Sem efeitos colaterais. Sem acesso a Firebase/window/localStorage.
	* Todas as funções retornam valores arredondados pela política centralizada.
	*/
	var EnergyCreditsCalculator = class {
		/** Fórmula 1: Saldo disponível antes das alocações (kWh) */
		availableKwhBeforeAllocation(previousBalance, monthlyGeneration) {
			return roundKwh(previousBalance + monthlyGeneration);
		}
		/** Fórmula 2: Total alocado (soma allocatedKwh dos registros) */
		totalAllocatedKwh(records) {
			return roundKwh(records.reduce((s, r) => s + (r.allocatedKwh || 0), 0));
		}
		/** Fórmula 3: Total compensado (soma compensatedKwh dos registros) */
		totalCompensatedKwh(records) {
			return roundKwh(records.reduce((s, r) => s + (r.compensatedKwh || 0), 0));
		}
		/** Fórmula 4: Total pendente (soma pendingKwh dos registros) */
		totalPendingKwh(records) {
			return roundKwh(records.reduce((s, r) => s + (r.pendingKwh || 0), 0));
		}
		/** Fórmula 5: Saldo acumulado atual */
		currentAccumulatedBalance(previousBalance, monthlyGeneration, totalAllocated) {
			return roundKwh(previousBalance + monthlyGeneration - totalAllocated);
		}
		/** Fórmula 6: Residual da beneficiária (nunca negativo) */
		residualKwh(monthlyConsumption, compensated) {
			return roundKwh(Math.max(0, monthlyConsumption - compensated));
		}
		/** Fórmula 7: Fatura sem ESA */
		billWithoutEsa(consumption, utilityTariff) {
			return roundMoney(consumption * utilityTariff);
		}
		/** Fórmula 8: Fatura ESA */
		esaInvoiceAmount(compensated, esaPrice) {
			return roundMoney(compensated * esaPrice);
		}
		/** Fórmula auxiliar: Parcela residual da distribuidora */
		residualUtilityAmount(residual, utilityTariff) {
			return roundMoney(residual * utilityTariff);
		}
		/** Fórmula 9: Fatura com ESA */
		billWithEsa(esaInvoice, residualUtility) {
			return roundMoney(esaInvoice + residualUtility);
		}
		/** Fórmula 10: Desconto mensal */
		monthlyDiscount(billWithoutEsa, billWithEsa) {
			return roundMoney(billWithoutEsa - billWithEsa);
		}
		/** Fórmula 11: Desconto acumulado total */
		accumulatedDiscountTotal(previousAccumulated, monthly) {
			return roundMoney(previousAccumulated + monthly);
		}
		/** Fórmula 12: Retorno mensal ao proprietário */
		monthlyOwnerReturn(totalCompensated, purchasePrice) {
			return roundMoney(totalCompensated * purchasePrice);
		}
		/** Fórmula 13: Receita ESA (soma esaInvoiceAmount dos registros) */
		totalEsaRevenue(records) {
			return roundMoney(records.reduce((s, r) => s + (r.esaInvoiceAmount || 0), 0));
		}
		/** Fórmula 14: Spread bruto ESA */
		grossSpread(totalEsaRevenue, totalOwnerReturn) {
			return roundMoney(totalEsaRevenue - totalOwnerReturn);
		}
	};
	//#endregion
	//#region ../../../domains/energy/credits/validator.js
	/**
	* ESA OS — Energy Domain / Credits
	* EnergyCreditsValidator
	*
	* Validações de domínio do módulo de créditos.
	* Retorna arrays de erros — nunca lança exceção para erros de negócio.
	* Funções são puras: sem estado, sem efeitos colaterais.
	*/
	var MONTH_RE$5 = /^\d{4}-(0[1-9]|1[0-2])$/;
	function _err$2(code, message, field = null, metadata = {}) {
		return {
			code,
			message,
			field,
			metadata
		};
	}
	function _warn$2(code, message, field = null, metadata = {}) {
		return {
			code,
			message,
			field,
			metadata
		};
	}
	var EnergyCreditsValidator = class {
		validateGeneratingUnit(input) {
			const errors = [];
			if (!input.id) errors.push(_err$2("REQUIRED", "id é obrigatório", "id"));
			if (!input.name) errors.push(_err$2("REQUIRED", "name é obrigatório", "name"));
			if (!input.ownerName) errors.push(_err$2("REQUIRED", "ownerName é obrigatório", "ownerName"));
			if (!input.uc) errors.push(_err$2("REQUIRED", "uc é obrigatório", "uc"));
			if (!input.utilityCompany) errors.push(_err$2("REQUIRED", "utilityCompany é obrigatório", "utilityCompany"));
			if (input.operationalStatus != null) {
				if (!Object.values(OPERATIONAL_STATUS).includes(input.operationalStatus)) errors.push(_err$2("INVALID_STATUS", `operationalStatus inválido. Válidos: ${Object.values(OPERATIONAL_STATUS).join(", ")}`, "operationalStatus"));
			}
			if (input.installedPower != null) {
				if (typeof input.installedPower !== "number" || isNaN(input.installedPower) || input.installedPower < 0) errors.push(_err$2("INVALID_VALUE", "installedPower deve ser número não-negativo", "installedPower"));
			}
			return errors;
		}
		validateBeneficiaryUnit(input) {
			const errors = [];
			if (!input.id) errors.push(_err$2("REQUIRED", "id é obrigatório", "id"));
			if (!input.generatingUnitId) errors.push(_err$2("REQUIRED", "generatingUnitId é obrigatório", "generatingUnitId"));
			if (!input.name) errors.push(_err$2("REQUIRED", "name é obrigatório", "name"));
			if (!input.uc) errors.push(_err$2("REQUIRED", "uc é obrigatório", "uc"));
			if (!input.utilityCompany) errors.push(_err$2("REQUIRED", "utilityCompany é obrigatório", "utilityCompany"));
			if (input.subscriptionStatus != null) {
				if (!Object.values(SUBSCRIPTION_STATUS).includes(input.subscriptionStatus)) errors.push(_err$2("INVALID_STATUS", `subscriptionStatus inválido. Válidos: ${Object.values(SUBSCRIPTION_STATUS).join(", ")}`, "subscriptionStatus"));
			}
			if (input.averageConsumption12Months != null) {
				if (typeof input.averageConsumption12Months !== "number" || isNaN(input.averageConsumption12Months) || input.averageConsumption12Months < 0) errors.push(_err$2("INVALID_VALUE", "averageConsumption12Months deve ser número não-negativo", "averageConsumption12Months"));
			}
			return errors;
		}
		validateReferenceMonth(value) {
			if (!value) return _err$2("REQUIRED", "referenceMonth é obrigatório", "referenceMonth");
			if (!MONTH_RE$5.test(value)) return _err$2("INVALID_FORMAT", "referenceMonth deve estar no formato YYYY-MM", "referenceMonth");
			return null;
		}
		validatePositive(value, field) {
			if (typeof value !== "number" || isNaN(value) || value < 0) return _err$2("INVALID_VALUE", `${field} deve ser número não-negativo`, field);
			return null;
		}
		validateAllocationConstraints(allocatedKwh, monthlyConsumptionKwh, availableKwh, options = {}) {
			const errors = [];
			const warnings = [];
			if (allocatedKwh > monthlyConsumptionKwh) errors.push(_err$2("ALLOCATION_EXCEEDS_CONSUMPTION", `allocatedKwh (${allocatedKwh}) não pode exceder monthlyConsumptionKwh (${monthlyConsumptionKwh})`, "allocatedKwh"));
			if (allocatedKwh > availableKwh) if (options.allowOverAllocation) warnings.push(_warn$2("INSUFFICIENT_BALANCE", `Alocados ${allocatedKwh} kWh mas disponível apenas ${availableKwh} kWh`, "allocatedKwh"));
			else errors.push(_err$2("ALLOCATION_EXCEEDS_BALANCE", `allocatedKwh (${allocatedKwh}) excede saldo disponível (${availableKwh})`, "allocatedKwh"));
			return {
				errors,
				warnings
			};
		}
		validateCompensation(compensatedKwh, allocatedKwh, field = "compensatedKwh") {
			if (compensatedKwh > allocatedKwh) return _err$2("COMPENSATION_EXCEEDS_ALLOCATION", `compensatedKwh (${compensatedKwh}) não pode exceder allocatedKwh (${allocatedKwh})`, field);
			return null;
		}
		validateStatementStatus(status) {
			if (!Object.values(STATEMENT_STATUS).includes(status)) return _err$2("INVALID_STATUS", `status inválido. Válidos: ${Object.values(STATEMENT_STATUS).join(", ")}`, "status");
			return null;
		}
		validateClosedMonth(status, force = false) {
			if (status === STATEMENT_STATUS.CLOSED && !force) return _err$2("MONTH_CLOSED", "Mês fechado não pode ser recalculado sem force=true", "status");
			return null;
		}
	};
	//#endregion
	//#region ../../../domains/energy/credits/service.js
	/**
	* ESA OS — Energy Domain / Credits
	* EnergyCreditsService
	*
	* Orquestra calculator + validator para produzir resultados de domínio.
	* Sem persistência. Sem acesso a Firebase, window ou localStorage.
	* Sem dependência de Date.now() — usa referenceDate quando necessário.
	* Funções de negócio retornam EnergyCreditsResult, nunca lançam exceção.
	*/
	var calc = new EnergyCreditsCalculator();
	var validator = new EnergyCreditsValidator();
	function _mkErr(code, message, field = null, metadata = {}) {
		return {
			code,
			message,
			field,
			metadata
		};
	}
	function _mkWarn(code, message, field = null, metadata = {}) {
		return {
			code,
			message,
			field,
			metadata
		};
	}
	function _alert(code, severity, message, targetType, targetId, metadata = {}) {
		return createAlert(code, severity, message, targetType, targetId, metadata);
	}
	var EnergyCreditsService = class {
		createGeneratingUnit(input = {}) {
			const errors = validator.validateGeneratingUnit(input);
			if (errors.length > 0) return EnergyCreditsResult.fail(errors);
			const unit = {
				id: input.id,
				name: input.name,
				ownerName: input.ownerName,
				ownerDocument: input.ownerDocument || null,
				uc: input.uc,
				address: input.address || null,
				city: input.city || null,
				state: input.state || null,
				utilityCompany: input.utilityCompany,
				pixKey: input.pixKey || null,
				installedPower: input.installedPower != null ? input.installedPower : null,
				operationalStatus: input.operationalStatus || OPERATIONAL_STATUS.ACTIVE,
				startedAt: input.startedAt || null,
				notes: input.notes || null
			};
			return EnergyCreditsResult.ok(unit);
		}
		createBeneficiaryUnit(input = {}) {
			const errors = validator.validateBeneficiaryUnit(input);
			if (errors.length > 0) return EnergyCreditsResult.fail(errors);
			const unit = {
				id: input.id,
				generatingUnitId: input.generatingUnitId,
				name: input.name,
				document: input.document || null,
				uc: input.uc,
				averageConsumption12Months: input.averageConsumption12Months != null ? input.averageConsumption12Months : null,
				address: input.address || null,
				city: input.city || null,
				state: input.state || null,
				utilityCompany: input.utilityCompany,
				subscriptionStatus: input.subscriptionStatus || SUBSCRIPTION_STATUS.ACTIVE,
				commercialResponsible: input.commercialResponsible || null,
				notes: input.notes || null
			};
			return EnergyCreditsResult.ok(unit);
		}
		calculateBeneficiaryMonthlyRecord(input = {}) {
			const { errors, warnings } = this._validateBeneficiaryRecord(input);
			if (errors.length > 0) return EnergyCreditsResult.fail(errors, warnings);
			const consumption = input.monthlyConsumptionKwh || 0;
			input.allocatedKwh;
			const compensated = input.compensatedKwh || 0;
			const pending = input.pendingKwh || 0;
			const esaPrice = input.esaKwhPrice != null ? input.esaKwhPrice : 0;
			const tariff = input.utilityReferenceTariff != null ? input.utilityReferenceTariff : 0;
			const prevDiscount = input.previousAccumulatedDiscount || 0;
			const residual = calc.residualKwh(consumption, compensated);
			const billWithout = calc.billWithoutEsa(consumption, tariff);
			const esaInvoice = calc.esaInvoiceAmount(compensated, esaPrice);
			const residualUtil = calc.residualUtilityAmount(residual, tariff);
			const billWith = calc.billWithEsa(esaInvoice, residualUtil);
			const monthly = calc.monthlyDiscount(billWithout, billWith);
			const accumulated = calc.accumulatedDiscountTotal(prevDiscount, monthly);
			if (monthly < 0) warnings.push(_mkWarn(ALERT_CODE.NEGATIVE_SAVINGS, `monthlyDiscount negativo (${monthly})`, "monthlyDiscount"));
			if (pending > 0) warnings.push(_mkWarn(ALERT_CODE.PENDING_COMPENSATION, `${pending} kWh pendentes de compensação`, "pendingKwh"));
			if (!consumption) warnings.push(_mkWarn(ALERT_CODE.ZERO_CONSUMPTION, "monthlyConsumptionKwh é zero", "monthlyConsumptionKwh"));
			const record = this._buildBeneficiaryRecord(input, {
				residual,
				billWithout,
				esaInvoice,
				residualUtil,
				billWith,
				monthly,
				accumulated
			});
			return EnergyCreditsResult.ok(record, warnings);
		}
		_validateBeneficiaryRecord(input) {
			const errors = [];
			const warnings = [];
			const mErr = validator.validateReferenceMonth(input.referenceMonth);
			if (mErr) errors.push(mErr);
			if (!input.beneficiaryUnitId) errors.push(_mkErr("REQUIRED", "beneficiaryUnitId é obrigatório", "beneficiaryUnitId"));
			if (!input.generatingUnitId) errors.push(_mkErr("REQUIRED", "generatingUnitId é obrigatório", "generatingUnitId"));
			for (const f of [
				"monthlyConsumptionKwh",
				"allocatedKwh",
				"compensatedKwh",
				"pendingKwh"
			]) if (input[f] != null) {
				const e = validator.validatePositive(input[f], f);
				if (e) errors.push(e);
			}
			const allocated = input.allocatedKwh || 0;
			const compensated = input.compensatedKwh || 0;
			const consumption = input.monthlyConsumptionKwh || 0;
			if (allocated > consumption) errors.push(_mkErr("ALLOCATION_EXCEEDS_CONSUMPTION", `allocatedKwh (${allocated}) não pode exceder monthlyConsumptionKwh (${consumption})`, "allocatedKwh"));
			if (compensated > allocated) errors.push(_mkErr("COMPENSATION_EXCEEDS_ALLOCATION", `compensatedKwh (${compensated}) não pode exceder allocatedKwh (${allocated})`, "compensatedKwh"));
			if (input.esaKwhPrice == null) warnings.push(_mkWarn(ALERT_CODE.MISSING_PRICE, "esaKwhPrice ausente", "esaKwhPrice"));
			if (input.utilityReferenceTariff == null) warnings.push(_mkWarn(ALERT_CODE.MISSING_TARIFF, "utilityReferenceTariff ausente", "utilityReferenceTariff"));
			return {
				errors,
				warnings
			};
		}
		_buildBeneficiaryRecord(input, amounts) {
			const { residual, billWithout, esaInvoice, residualUtil, billWith, monthly, accumulated } = amounts;
			return {
				id: input.id || null,
				beneficiaryUnitId: input.beneficiaryUnitId,
				generatingUnitId: input.generatingUnitId,
				referenceMonth: input.referenceMonth,
				monthlyConsumptionKwh: roundKwh(input.monthlyConsumptionKwh || 0),
				allocatedKwh: roundKwh(input.allocatedKwh || 0),
				compensatedKwh: roundKwh(input.compensatedKwh || 0),
				pendingKwh: roundKwh(input.pendingKwh || 0),
				residualKwh: residual,
				esaKwhPrice: input.esaKwhPrice != null ? roundMoney(input.esaKwhPrice) : null,
				utilityReferenceTariff: input.utilityReferenceTariff != null ? roundMoney(input.utilityReferenceTariff) : null,
				billWithoutEsa: billWithout,
				esaInvoiceAmount: esaInvoice,
				residualUtilityAmount: residualUtil,
				billWithEsa: billWith,
				monthlyDiscount: monthly,
				previousAccumulatedDiscount: roundMoney(input.previousAccumulatedDiscount || 0),
				accumulatedDiscountTotal: accumulated,
				paymentStatus: input.paymentStatus || PAYMENT_STATUS.PENDING,
				dueDate: input.dueDate || null,
				paidAt: input.paidAt || null,
				notes: input.notes || null
			};
		}
		calculateGeneratingUnitMonthlyRecord(input = {}) {
			const errors = [];
			const warnings = [];
			const mErr = validator.validateReferenceMonth(input.referenceMonth);
			if (mErr) errors.push(mErr);
			if (!input.generatingUnitId) errors.push(_mkErr("REQUIRED", "generatingUnitId é obrigatório", "generatingUnitId"));
			if (errors.length > 0) return EnergyCreditsResult.fail(errors, warnings);
			const previous = input.previousAccumulatedKwhBalance || 0;
			const generation = input.monthlyGenerationKwh || 0;
			const price = input.purchaseKwhPrice;
			const recs = Array.isArray(input.beneficiaryRecords) ? input.beneficiaryRecords : [];
			const available = calc.availableKwhBeforeAllocation(previous, generation);
			const totalAlloc = calc.totalAllocatedKwh(recs);
			const totalComp = calc.totalCompensatedKwh(recs);
			const currBal = calc.currentAccumulatedBalance(previous, generation, totalAlloc);
			const ownerRet = price != null ? calc.monthlyOwnerReturn(totalComp, price) : null;
			const prevOwner = input.accumulatedOwnerReturn || 0;
			const accumOwner = ownerRet != null ? roundMoney(prevOwner + ownerRet) : null;
			if (!generation) warnings.push(_mkWarn(ALERT_CODE.ZERO_GENERATION, "monthlyGenerationKwh é zero", "monthlyGenerationKwh"));
			if (price == null) warnings.push(_mkWarn(ALERT_CODE.MISSING_PRICE, "purchaseKwhPrice ausente", "purchaseKwhPrice"));
			if (recs.length === 0) warnings.push(_mkWarn(ALERT_CODE.NO_BENEFICIARIES, "Sem registros de beneficiárias", "beneficiaryRecords"));
			const record = {
				id: input.id || null,
				generatingUnitId: input.generatingUnitId,
				referenceMonth: input.referenceMonth,
				purchaseKwhPrice: price != null ? roundMoney(price) : null,
				previousAccumulatedKwhBalance: roundKwh(previous),
				monthlyGenerationKwh: roundKwh(generation),
				availableKwhBeforeAllocation: available,
				consumedAllocatedKwh: totalAlloc,
				currentAccumulatedKwhBalance: currBal,
				monthlyOwnerReturn: ownerRet,
				accumulatedOwnerReturn: accumOwner,
				status: input.status || STATEMENT_STATUS.OPEN,
				notes: input.notes || null
			};
			return EnergyCreditsResult.ok(record, warnings);
		}
		calculateMonthlyStatement(input = {}, options = {}) {
			const errors = [];
			const warnings = [];
			const mErr = validator.validateReferenceMonth(input.referenceMonth);
			if (mErr) errors.push(mErr);
			if (!input.generatingUnitId) errors.push(_mkErr("REQUIRED", "generatingUnitId é obrigatório", "generatingUnitId"));
			if (input.status) {
				const cErr = validator.validateClosedMonth(input.status, options.force);
				if (cErr) return EnergyCreditsResult.fail([cErr]);
			}
			if (errors.length > 0) return EnergyCreditsResult.fail(errors, warnings);
			const previous = input.previousAccumulatedKwhBalance || 0;
			const generation = input.monthlyGenerationKwh || 0;
			const price = input.purchaseKwhPrice;
			const recs = Array.isArray(input.beneficiaryRecords) ? input.beneficiaryRecords : [];
			const available = calc.availableKwhBeforeAllocation(previous, generation);
			const totalAlloc = calc.totalAllocatedKwh(recs);
			if (!options.allowOverAllocation && totalAlloc > available) {
				errors.push(_mkErr("OVER_ALLOCATION_BLOCKED", `totalAllocatedKwh (${totalAlloc}) excede saldo disponível (${available})`, "totalAllocatedKwh"));
				return EnergyCreditsResult.fail(errors, warnings);
			}
			const totals = this._computeStatementTotals(recs, previous, generation, totalAlloc, price);
			const alerts = this._buildStatementAlerts(input, totalAlloc, available, options, recs);
			const stmt = this._buildStatementObject(input, totals, available, alerts);
			return EnergyCreditsResult.ok(stmt, warnings);
		}
		_computeStatementTotals(recs, previous, generation, totalAlloc, price) {
			const totalComp = calc.totalCompensatedKwh(recs);
			const totalPending = calc.totalPendingKwh(recs);
			const totalResidual = roundKwh(recs.reduce((s, r) => s + (r.residualKwh || 0), 0));
			const currentBal = calc.currentAccumulatedBalance(previous, generation, totalAlloc);
			const ownerReturn = price != null ? calc.monthlyOwnerReturn(totalComp, price) : null;
			const esaRevenue = calc.totalEsaRevenue(recs);
			return {
				totalComp,
				totalPending,
				totalResidual,
				currentBal,
				ownerReturn,
				esaRevenue,
				spread: ownerReturn != null ? calc.grossSpread(esaRevenue, ownerReturn) : null
			};
		}
		_buildStatementAlerts(input, totalAlloc, available, options, recs) {
			const alerts = [];
			const gid = input.generatingUnitId;
			const gen = input.monthlyGenerationKwh;
			const price = input.purchaseKwhPrice;
			if (!gen || gen === 0) alerts.push(_alert(ALERT_CODE.ZERO_GENERATION, ALERT_SEVERITY.ATTENTION, "Geração zero", "generatingUnit", gid));
			if (recs.length === 0) alerts.push(_alert(ALERT_CODE.NO_BENEFICIARIES, ALERT_SEVERITY.ATTENTION, "Sem beneficiárias", "generatingUnit", gid));
			if (price == null) alerts.push(_alert(ALERT_CODE.MISSING_PRICE, ALERT_SEVERITY.RISK, "purchaseKwhPrice ausente", "generatingUnit", gid));
			if (options.allowOverAllocation && totalAlloc > available) alerts.push(_alert(ALERT_CODE.INSUFFICIENT_BALANCE, ALERT_SEVERITY.CRITICAL, `Over-allocated: ${totalAlloc} kWh alocados, ${available} kWh disponíveis`, "generatingUnit", gid, {
				totalAllocated: totalAlloc,
				available
			}));
			for (const r of recs) {
				const bid = r.beneficiaryUnitId;
				if (r.esaKwhPrice == null) alerts.push(_alert(ALERT_CODE.MISSING_PRICE, ALERT_SEVERITY.RISK, "esaKwhPrice ausente", "beneficiaryUnit", bid));
				if (r.utilityReferenceTariff == null) alerts.push(_alert(ALERT_CODE.MISSING_TARIFF, ALERT_SEVERITY.RISK, "utilityReferenceTariff ausente", "beneficiaryUnit", bid));
				if (!r.monthlyConsumptionKwh) alerts.push(_alert(ALERT_CODE.ZERO_CONSUMPTION, ALERT_SEVERITY.INFO, "Consumo zero", "beneficiaryUnit", bid));
				if ((r.pendingKwh || 0) > 0) alerts.push(_alert(ALERT_CODE.PENDING_COMPENSATION, ALERT_SEVERITY.ATTENTION, `${r.pendingKwh} kWh pendentes`, "beneficiaryUnit", bid));
				if ((r.monthlyDiscount || 0) < 0) alerts.push(_alert(ALERT_CODE.NEGATIVE_SAVINGS, ALERT_SEVERITY.ATTENTION, "Economia negativa", "beneficiaryUnit", bid));
			}
			return alerts;
		}
		_buildStatementObject(input, totals, available, alerts) {
			const recs = Array.isArray(input.beneficiaryRecords) ? input.beneficiaryRecords : [];
			return {
				referenceMonth: input.referenceMonth,
				generatingUnitId: input.generatingUnitId,
				totalGenerationKwh: roundKwh(input.monthlyGenerationKwh || 0),
				previousBalanceKwh: roundKwh(input.previousAccumulatedKwhBalance || 0),
				availableKwhBeforeAllocation: available,
				totalAllocatedKwh: calc.totalAllocatedKwh(recs),
				totalCompensatedKwh: totals.totalComp,
				totalPendingKwh: totals.totalPending,
				totalResidualKwh: totals.totalResidual,
				currentBalanceKwh: totals.currentBal,
				totalOwnerReturn: totals.ownerReturn,
				totalEsaRevenue: totals.esaRevenue,
				grossSpread: totals.spread,
				beneficiaryCount: recs.length,
				alerts,
				metadata: {
					generatedAt: input.referenceDate || null,
					status: input.status || STATEMENT_STATUS.OPEN,
					source: "energy-credits-service"
				}
			};
		}
		validateAllocation(input = {}) {
			const errors = [];
			const warnings = [];
			const opts = input.options || {};
			const allocated = input.allocatedKwh || 0;
			const consumption = input.monthlyConsumptionKwh || 0;
			const available = input.availableKwh || 0;
			const alloc = validator.validateAllocationConstraints(allocated, consumption, available, opts);
			errors.push(...alloc.errors);
			warnings.push(...alloc.warnings);
			if (input.compensatedKwh != null) {
				const cErr = validator.validateCompensation(input.compensatedKwh, allocated);
				if (cErr) errors.push(cErr);
			}
			if (errors.length > 0) return EnergyCreditsResult.fail(errors, warnings);
			return EnergyCreditsResult.ok({ valid: true }, warnings);
		}
		calculateOwnerSettlement(input = {}) {
			const errors = [];
			const mErr = validator.validateReferenceMonth(input.referenceMonth);
			if (mErr) errors.push(mErr);
			if (!input.generatingUnitId) errors.push(_mkErr("REQUIRED", "generatingUnitId é obrigatório", "generatingUnitId"));
			if (!input.ownerName) errors.push(_mkErr("REQUIRED", "ownerName é obrigatório", "ownerName"));
			if (errors.length > 0) return EnergyCreditsResult.fail(errors);
			const consumed = input.consumedAllocatedKwh || 0;
			const price = input.purchaseKwhPrice || 0;
			const gross = calc.monthlyOwnerReturn(consumed, price);
			const adjustments = input.adjustments || 0;
			const net = roundMoney(gross + adjustments);
			const settlement = {
				id: input.id || null,
				generatingUnitId: input.generatingUnitId,
				ownerName: input.ownerName,
				referenceMonth: input.referenceMonth,
				consumedAllocatedKwh: roundKwh(consumed),
				purchaseKwhPrice: roundMoney(price),
				grossReturn: gross,
				adjustments: roundMoney(adjustments),
				netReturn: net,
				paymentStatus: input.paymentStatus || PAYMENT_STATUS.PENDING,
				dueDate: input.dueDate || null,
				paidAt: input.paidAt || null
			};
			return EnergyCreditsResult.ok(settlement);
		}
		calculateEsaInvoice(input = {}) {
			const errors = [];
			const warnings = [];
			const mErr = validator.validateReferenceMonth(input.referenceMonth);
			if (mErr) errors.push(mErr);
			if (!input.beneficiaryUnitId) errors.push(_mkErr("REQUIRED", "beneficiaryUnitId é obrigatório", "beneficiaryUnitId"));
			if (errors.length > 0) return EnergyCreditsResult.fail(errors, warnings);
			if (input.esaKwhPrice == null) warnings.push(_mkWarn(ALERT_CODE.MISSING_PRICE, "esaKwhPrice ausente", "esaKwhPrice"));
			const compensated = input.compensatedKwh || 0;
			const consumed = input.consumedKwh || 0;
			const esaPrice = input.esaKwhPrice != null ? input.esaKwhPrice : 0;
			const amount = calc.esaInvoiceAmount(compensated, esaPrice);
			const invoice = {
				id: input.id || null,
				beneficiaryUnitId: input.beneficiaryUnitId,
				referenceMonth: input.referenceMonth,
				consumedKwh: roundKwh(consumed),
				compensatedKwh: roundKwh(compensated),
				esaKwhPrice: input.esaKwhPrice != null ? roundMoney(input.esaKwhPrice) : null,
				invoiceAmount: amount,
				paymentStatus: input.paymentStatus || PAYMENT_STATUS.PENDING,
				dueDate: input.dueDate || null,
				paidAt: input.paidAt || null
			};
			return EnergyCreditsResult.ok(invoice, warnings);
		}
	};
	//#endregion
	//#region ../../../domains/energy/credits/allocation/credit-allocation-result.js
	/**
	* ESA OS — Energy Domain / Credits / Allocation
	* CreditAllocationResult
	*
	* Contrato de resultado consistente para operações de rateio e saldo de créditos.
	* Espelha o padrão de EnergyCreditsResult — nunca lança exceção para erros de negócio.
	*/
	var CreditAllocationResult = class {
		static ok(data, warnings = [], metadata = {}) {
			return {
				ok: true,
				data,
				errors: [],
				warnings,
				metadata
			};
		}
		static fail(errors, warnings = [], metadata = {}) {
			return {
				ok: false,
				data: null,
				errors: Array.isArray(errors) ? errors : [errors],
				warnings,
				metadata
			};
		}
		static makeError(code, message, field = null, metadata = {}) {
			return {
				code,
				message,
				field,
				metadata
			};
		}
		static makeWarning(code, message, field = null, metadata = {}) {
			return {
				code,
				message,
				field,
				metadata
			};
		}
	};
	//#endregion
	//#region ../../../domains/energy/credits/allocation/allocation-alert.js
	/**
	* ESA OS — Energy Domain / Credits / Allocation
	* Alertas e limiares da camada de rateio e saldo.
	*/
	var ALLOCATION_ALERT_CODE = Object.freeze({
		HIGH_BENEFICIARY_CREDIT_BALANCE: "HIGH_BENEFICIARY_CREDIT_BALANCE",
		LOW_BENEFICIARY_CREDIT_BALANCE: "LOW_BENEFICIARY_CREDIT_BALANCE",
		ALLOCATION_PERCENTAGE_TOTAL_INVALID: "ALLOCATION_PERCENTAGE_TOTAL_INVALID",
		PARTIAL_MANUAL_ALLOCATION_NOT_ALLOWED: "PARTIAL_MANUAL_ALLOCATION_NOT_ALLOWED",
		CONSUMPTION_ABOVE_AVERAGE: "CONSUMPTION_ABOVE_AVERAGE",
		NEGATIVE_BALANCE: "NEGATIVE_BALANCE",
		MAX_PREVENTIVE_MARGIN_EXCEEDED: "MAX_PREVENTIVE_MARGIN_EXCEEDED"
	});
	/**
	* Limiares operacionais default.
	* Todos os valores são configuráveis via options.thresholds nas calculadoras.
	*/
	var ALLOCATION_THRESHOLDS = Object.freeze({
		HIGH_BALANCE_COVERAGE_MONTHS: 1.5,
		CONSUMPTION_ABOVE_AVERAGE_FACTOR: 1.1,
		MAX_PREVENTIVE_MARGIN_PCT: 20,
		MANUAL_ALLOCATION_TOLERANCE_PP: .01
	});
	//#endregion
	//#region ../../../domains/energy/credits/allocation/consumption-average-calculator.js
	/**
	* ESA OS — Energy Domain / Credits / Allocation
	* BeneficiaryConsumptionAverageCalculator
	*
	* Calcula a média histórica de consumo de uma UC beneficiária.
	* Janela configurável (default 12 meses). Sem Date.now(). Determinístico.
	*/
	var MONTH_RE$4 = /^\d{4}-(0[1-9]|1[0-2])$/;
	function _isValidRecord(r) {
		return r && typeof r === "object" && typeof r.referenceMonth === "string" && MONTH_RE$4.test(r.referenceMonth) && typeof r.consumptionKwh === "number" && isFinite(r.consumptionKwh) && r.consumptionKwh >= 0;
	}
	function _filterAndSort(history, referenceMonth) {
		let sorted = [...(Array.isArray(history) ? history : []).filter(_isValidRecord)].sort((a, b) => a.referenceMonth.localeCompare(b.referenceMonth));
		if (referenceMonth && MONTH_RE$4.test(referenceMonth)) sorted = sorted.filter((r) => r.referenceMonth <= referenceMonth);
		return sorted;
	}
	function _emptyResult(beneficiaryUnitId, monthWindow, referenceMonth) {
		return CreditAllocationResult.ok({
			beneficiaryUnitId,
			monthsConsidered: 0,
			totalConsumptionKwh: 0,
			averageMonthlyConsumptionKwh: 0,
			historyFrom: null,
			historyTo: null,
			metadata: {
				monthWindow,
				referenceMonth
			}
		});
	}
	var BeneficiaryConsumptionAverageCalculator = class {
		calculate(input = {}) {
			const { beneficiaryUnitId, monthlyConsumptionHistory, options = {} } = input || {};
			const { monthWindow = 12, referenceMonth = null } = options;
			if (!beneficiaryUnitId || typeof beneficiaryUnitId !== "string") return CreditAllocationResult.fail([CreditAllocationResult.makeError("REQUIRED", "beneficiaryUnitId é obrigatório", "beneficiaryUnitId")]);
			const window = _filterAndSort(monthlyConsumptionHistory, referenceMonth).slice(-Math.max(1, Math.floor(monthWindow || 12)));
			const monthsConsidered = window.length;
			if (monthsConsidered === 0) return _emptyResult(beneficiaryUnitId, monthWindow, referenceMonth);
			const totalConsumptionKwh = roundKwh(window.reduce((s, r) => s + r.consumptionKwh, 0));
			const averageMonthlyConsumptionKwh = roundKwh(totalConsumptionKwh / monthsConsidered);
			return CreditAllocationResult.ok({
				beneficiaryUnitId,
				monthsConsidered,
				totalConsumptionKwh,
				averageMonthlyConsumptionKwh,
				historyFrom: window[0].referenceMonth,
				historyTo: window[window.length - 1].referenceMonth,
				metadata: {
					monthWindow,
					referenceMonth
				}
			});
		}
	};
	//#endregion
	//#region ../../../domains/energy/credits/allocation/credit-allocation-planner.js
	/**
	* ESA OS — Energy Domain / Credits / Allocation
	* CreditAllocationPlanner
	*
	* Calcula o plano de rateio percentual da geração disponível entre UCs beneficiárias.
	* Suporta modo automático (baseado em média e margem preventiva) e modo manual.
	* Reconciliação determinística do resíduo de arredondamento: aplicada à primeira UC (por beneficiaryUnitId).
	* Sem Date.now(). Sem Math.random(). Mesma entrada = mesma saída.
	*/
	var MAX_MARGIN = ALLOCATION_THRESHOLDS.MAX_PREVENTIVE_MARGIN_PCT;
	var MANUAL_TOL = ALLOCATION_THRESHOLDS.MANUAL_ALLOCATION_TOLERANCE_PP;
	function _roundPct(v) {
		return Math.round(v * 1e4) / 1e4;
	}
	function _isManualMode(bens) {
		return bens.length > 0 && bens.every((b) => typeof b.manualAllocationPercentage === "number");
	}
	function _isPartialManual(bens) {
		const some = bens.some((b) => typeof b.manualAllocationPercentage === "number");
		const all = bens.every((b) => typeof b.manualAllocationPercentage === "number");
		return some && !all;
	}
	function _buildEntry(b) {
		const avg = typeof b.averageMonthlyConsumptionKwh === "number" ? b.averageMonthlyConsumptionKwh : 0;
		const margin = typeof b.preventiveMarginPercentage === "number" ? b.preventiveMarginPercentage : 0;
		const balance = typeof b.currentBeneficiaryCreditBalanceKwh === "number" ? b.currentBeneficiaryCreditBalanceKwh : 0;
		const target = roundKwh(avg * (1 + margin / 100));
		const recommended = roundKwh(Math.max(0, target - balance));
		return {
			beneficiaryUnitId: b.beneficiaryUnitId,
			beneficiaryUc: b.beneficiaryUc || null,
			averageMonthlyConsumptionKwh: avg,
			preventiveMarginPercentage: margin,
			currentBeneficiaryCreditBalanceKwh: balance,
			targetCreditKwh: target,
			recommendedCreditsToReceiveKwh: recommended,
			allocationPercentage: 0,
			plannedCreditsReceivedKwh: 0,
			residueApplied: false
		};
	}
	function _assignAutoPercentages(items, generation) {
		const total = roundKwh(items.reduce((s, i) => s + i.recommendedCreditsToReceiveKwh, 0));
		for (const item of items) {
			item.allocationPercentage = total > 0 ? _roundPct(item.recommendedCreditsToReceiveKwh / total * 100) : 0;
			item.plannedCreditsReceivedKwh = total > 0 ? roundKwh(generation * item.allocationPercentage / 100) : 0;
		}
		return total;
	}
	function _assignManualPercentages(items, generation) {
		for (const item of items) {
			item.allocationPercentage = item._manualPct;
			item.plannedCreditsReceivedKwh = roundKwh(generation * item.allocationPercentage / 100);
			delete item._manualPct;
		}
	}
	function _reconcile(items, generation) {
		if (items.length === 0) return;
		const sumPlanned = items.reduce((s, i) => s + i.plannedCreditsReceivedKwh, 0);
		if (sumPlanned === 0) return;
		const residue = roundKwh(generation - sumPlanned);
		if (residue !== 0) {
			items[0].plannedCreditsReceivedKwh = roundKwh(items[0].plannedCreditsReceivedKwh + residue);
			items[0].residueApplied = true;
		}
	}
	function _buildMarginWarnings(bens) {
		return bens.filter((b) => typeof b.preventiveMarginPercentage === "number" && b.preventiveMarginPercentage > MAX_MARGIN).map((b) => CreditAllocationResult.makeWarning(ALLOCATION_ALERT_CODE.MAX_PREVENTIVE_MARGIN_EXCEEDED, `Margem preventiva ${b.preventiveMarginPercentage}% excede o limite de ${MAX_MARGIN}% para ${b.beneficiaryUnitId}`, "preventiveMarginPercentage", {
			beneficiaryUnitId: b.beneficiaryUnitId,
			margin: b.preventiveMarginPercentage,
			maxMargin: MAX_MARGIN
		}));
	}
	function _validateInput$1(input) {
		if (!input || typeof input !== "object") return "INPUT_REQUIRED";
		if (!input.generatingUnitId) return "GENERATING_UNIT_ID_REQUIRED";
		if (!Array.isArray(input.beneficiaries)) return "BENEFICIARIES_REQUIRED";
		if (typeof input.generationAvailableKwh !== "number" || isNaN(input.generationAvailableKwh)) return "GENERATION_AVAILABLE_KWH_REQUIRED";
		return null;
	}
	function _buildOutput(generatingUnitId, referenceMonth, generation, items, mode, totalRecommended) {
		return {
			generatingUnitId,
			referenceMonth,
			generationAvailableKwh: generation,
			mode,
			totalRecommendedCreditsKwh: totalRecommended,
			beneficiaries: items,
			totalPlannedCreditsKwh: roundKwh(items.reduce((s, i) => s + i.plannedCreditsReceivedKwh, 0))
		};
	}
	var CreditAllocationPlanner = class {
		planAllocation(input = {}) {
			const inputErr = _validateInput$1(input);
			if (inputErr) return CreditAllocationResult.fail([CreditAllocationResult.makeError(inputErr, `${inputErr} é obrigatório`)]);
			const { generatingUnitId, referenceMonth = null, generationAvailableKwh, beneficiaries } = input;
			const generation = roundKwh(Math.max(0, generationAvailableKwh));
			const sorted = [...beneficiaries].sort((a, b) => (a.beneficiaryUnitId || "").localeCompare(b.beneficiaryUnitId || ""));
			const warnings = _buildMarginWarnings(beneficiaries);
			if (_isPartialManual(sorted)) return CreditAllocationResult.fail([CreditAllocationResult.makeError(ALLOCATION_ALERT_CODE.PARTIAL_MANUAL_ALLOCATION_NOT_ALLOWED, "Todas as beneficiárias devem ter percentual manual definido, ou nenhuma. Mistura não é permitida.", "manualAllocationPercentage")], warnings);
			return _isManualMode(sorted) ? this._planManual(generatingUnitId, referenceMonth, generation, sorted, warnings) : this._planAuto(generatingUnitId, referenceMonth, generation, sorted, warnings);
		}
		_planAuto(generatingUnitId, referenceMonth, generation, sorted, warnings) {
			const items = sorted.map(_buildEntry);
			const totalRecommended = _assignAutoPercentages(items, generation);
			_reconcile(items, generation);
			return CreditAllocationResult.ok(_buildOutput(generatingUnitId, referenceMonth, generation, items, "auto", totalRecommended), warnings);
		}
		_planManual(generatingUnitId, referenceMonth, generation, sorted, warnings) {
			const sumPct = sorted.reduce((s, b) => s + (b.manualAllocationPercentage || 0), 0);
			if (Math.abs(sumPct - 100) > MANUAL_TOL) return CreditAllocationResult.fail([CreditAllocationResult.makeError(ALLOCATION_ALERT_CODE.ALLOCATION_PERCENTAGE_TOTAL_INVALID, `Soma dos percentuais manuais é ${_roundPct(sumPct)}% — esperado 100% ± ${MANUAL_TOL}pp`, "manualAllocationPercentage", {
				sum: _roundPct(sumPct),
				tolerance: MANUAL_TOL
			})], warnings);
			const items = sorted.map((b) => {
				const e = _buildEntry(b);
				e._manualPct = b.manualAllocationPercentage;
				return e;
			});
			_assignManualPercentages(items, generation);
			_reconcile(items, generation);
			const totalRecommended = roundKwh(items.reduce((s, i) => s + i.recommendedCreditsToReceiveKwh, 0));
			return CreditAllocationResult.ok(_buildOutput(generatingUnitId, referenceMonth, generation, items, "manual", totalRecommended), warnings);
		}
	};
	//#endregion
	//#region ../../../domains/energy/credits/allocation/beneficiary-credit-balance-calculator.js
	/**
	* ESA OS — Energy Domain / Credits / Allocation
	* BeneficiaryCreditBalanceCalculator
	*
	* Calcula o saldo de créditos individual de uma UC beneficiária para um dado mês.
	* Produz BeneficiaryCreditBalanceRecord com alertas operacionais.
	* Saldo negativo bloqueado por padrão (options.allowNegativeBalance = true para permitir).
	* Sem Date.now(). Determinístico.
	*/
	var MONTH_RE$3 = /^\d{4}-(0[1-9]|1[0-2])$/;
	var NUM_FIELDS = [
		"previousBalanceKwh",
		"creditsReceivedKwh",
		"creditsCompensatedKwh",
		"positiveAdjustmentsKwh",
		"negativeAdjustmentsKwh"
	];
	function _validateInput(input) {
		if (!input || typeof input !== "object") return ["INPUT_REQUIRED"];
		const errors = [];
		if (!input.beneficiaryUnitId) errors.push("beneficiaryUnitId é obrigatório");
		if (!input.referenceMonth || !MONTH_RE$3.test(input.referenceMonth)) errors.push("referenceMonth inválido (esperado YYYY-MM)");
		for (const f of NUM_FIELDS) {
			const v = input[f];
			if (typeof v !== "number" || isNaN(v)) errors.push(`${f} deve ser um número`);
			else if (v < 0) errors.push(`${f} não pode ser negativo`);
		}
		return errors;
	}
	function _computeBalance(input) {
		return (input.previousBalanceKwh || 0) + (input.creditsReceivedKwh || 0) + (input.positiveAdjustmentsKwh || 0) - (input.creditsCompensatedKwh || 0) - (input.negativeAdjustmentsKwh || 0);
	}
	function _coverage(balance, avg) {
		if (!avg || avg <= 0) return null;
		return roundMoney(balance / avg);
	}
	function _status(balance, coverage, thr) {
		const HIGH = thr.HIGH_BALANCE_COVERAGE_MONTHS ?? ALLOCATION_THRESHOLDS.HIGH_BALANCE_COVERAGE_MONTHS;
		if (balance < 0) return "negative";
		if (balance === 0) return "empty";
		if (coverage !== null && coverage > HIGH) return "high";
		return "ok";
	}
	function _buildAlerts(balance, avg, target, planned, coverage, consumption, thr) {
		const alerts = [];
		const HIGH = thr.HIGH_BALANCE_COVERAGE_MONTHS ?? ALLOCATION_THRESHOLDS.HIGH_BALANCE_COVERAGE_MONTHS;
		const ABOVE = thr.CONSUMPTION_ABOVE_AVERAGE_FACTOR ?? ALLOCATION_THRESHOLDS.CONSUMPTION_ABOVE_AVERAGE_FACTOR;
		if (balance < 0) alerts.push({
			code: ALLOCATION_ALERT_CODE.NEGATIVE_BALANCE,
			severity: "critical",
			message: `Saldo negativo: ${balance} kWh`
		});
		if (coverage !== null && coverage > HIGH) alerts.push({
			code: ALLOCATION_ALERT_CODE.HIGH_BENEFICIARY_CREDIT_BALANCE,
			severity: "attention",
			message: `Saldo acumulado superior a ${HIGH} meses da média de consumo (${coverage} meses).`
		});
		if (target !== null && planned !== null) {
			const available = roundKwh(balance + planned);
			if (available < target) alerts.push({
				code: ALLOCATION_ALERT_CODE.LOW_BENEFICIARY_CREDIT_BALANCE,
				severity: "risk",
				message: `Saldo disponível + crédito planejado (${available} kWh) inferior ao crédito alvo (${target} kWh).`
			});
		}
		if (avg > 0 && consumption !== null && typeof consumption === "number" && consumption > avg * ABOVE) alerts.push({
			code: ALLOCATION_ALERT_CODE.CONSUMPTION_ABOVE_AVERAGE,
			severity: "attention",
			message: `Consumo real (${consumption} kWh) acima de ${Math.round(ABOVE * 100)}% da média (${avg} kWh).`
		});
		return alerts;
	}
	function _buildRecord$1(input, balance, coverage, status, alerts) {
		return {
			id: `beneficiary-credit-balance-${input.beneficiaryUnitId}-${input.referenceMonth}`,
			beneficiaryUnitId: input.beneficiaryUnitId,
			generatingUnitId: input.generatingUnitId || null,
			beneficiaryUc: input.beneficiaryUc || null,
			referenceMonth: input.referenceMonth,
			previousBalanceKwh: input.previousBalanceKwh || 0,
			creditsReceivedKwh: input.creditsReceivedKwh || 0,
			creditsCompensatedKwh: input.creditsCompensatedKwh || 0,
			positiveAdjustmentsKwh: input.positiveAdjustmentsKwh || 0,
			negativeAdjustmentsKwh: input.negativeAdjustmentsKwh || 0,
			currentBalanceKwh: balance,
			averageMonthlyConsumptionKwh: typeof input.averageMonthlyConsumptionKwh === "number" ? input.averageMonthlyConsumptionKwh : 0,
			preventiveMarginPercentage: typeof input.preventiveMarginPercentage === "number" ? input.preventiveMarginPercentage : 0,
			targetCreditKwh: typeof input.targetCreditKwh === "number" ? input.targetCreditKwh : null,
			allocationPercentage: typeof input.allocationPercentage === "number" ? input.allocationPercentage : null,
			coverageMonths: coverage,
			status,
			alerts,
			metadata: { source: "beneficiary-credit-balance-calculator" }
		};
	}
	var BeneficiaryCreditBalanceCalculator = class {
		calculate(input = {}) {
			const errs = _validateInput(input);
			if (errs.length > 0) return CreditAllocationResult.fail(errs.map((m) => CreditAllocationResult.makeError("VALIDATION_ERROR", m)));
			const opts = input.options && typeof input.options === "object" ? input.options : {};
			const allowNeg = opts.allowNegativeBalance === true;
			const thr = {
				...ALLOCATION_THRESHOLDS,
				...opts.thresholds || {}
			};
			const avg = typeof input.averageMonthlyConsumptionKwh === "number" ? input.averageMonthlyConsumptionKwh : 0;
			const target = typeof input.targetCreditKwh === "number" ? input.targetCreditKwh : null;
			const planned = typeof input.plannedCreditsReceivedKwh === "number" ? input.plannedCreditsReceivedKwh : null;
			const consumption = typeof input.monthlyConsumptionKwh === "number" ? input.monthlyConsumptionKwh : null;
			const currentBalanceKwh = roundKwh(_computeBalance(input));
			if (currentBalanceKwh < 0 && !allowNeg) return CreditAllocationResult.fail([CreditAllocationResult.makeError("NEGATIVE_BALANCE_NOT_ALLOWED", `Saldo negativo não permitido: ${currentBalanceKwh} kWh. Use options.allowNegativeBalance = true para permitir.`, "currentBalanceKwh")]);
			const coverage = _coverage(currentBalanceKwh, avg);
			const alerts = _buildAlerts(currentBalanceKwh, avg, target, planned, coverage, consumption, thr);
			const record = _buildRecord$1(input, currentBalanceKwh, coverage, _status(currentBalanceKwh, coverage, thr), alerts);
			const warnings = alerts.map((a) => CreditAllocationResult.makeWarning(a.code, a.message));
			return CreditAllocationResult.ok(record, warnings);
		}
	};
	//#endregion
	//#region ../../../domains/energy/credits/allocation/index.js
	var consumptionAverageCalculator = new BeneficiaryConsumptionAverageCalculator();
	var creditAllocationPlanner = new CreditAllocationPlanner();
	var beneficiaryCreditBalanceCalculator = new BeneficiaryCreditBalanceCalculator();
	//#endregion
	//#region ../../../read-models/energy-credits/energy-credits-read-model.js
	/**
	* ESA OS — Energy Domain / Credits
	* EnergyCreditsReadModel
	*
	* Projeção em memória dos dados de créditos de energia.
	* Oito coleções, isoladas e normalizadas.
	* Sem Firebase. Sem persistência. Sem efeitos colaterais.
	*/
	var MONTH_RE$2 = /^\d{4}-(0[1-9]|1[0-2])$/;
	function _str$1(v) {
		if (v === null || v === void 0) return null;
		const s = String(v);
		return s === "[object Object]" ? null : s;
	}
	function _num(v) {
		if (v === null || v === void 0) return null;
		const n = Number(v);
		return isNaN(n) ? null : n;
	}
	function _toArray(raw) {
		if (!raw) return [];
		if (Array.isArray(raw)) return raw;
		if (typeof raw === "object") return Object.values(raw);
		return [];
	}
	function _applyMonthFilter(items, filters) {
		let result = items;
		if (filters.referenceMonth != null) result = result.filter((r) => r.referenceMonth === filters.referenceMonth);
		if (filters.referenceMonthFrom != null) result = result.filter((r) => r.referenceMonth >= filters.referenceMonthFrom);
		if (filters.referenceMonthTo != null) result = result.filter((r) => r.referenceMonth <= filters.referenceMonthTo);
		return result;
	}
	function _normalizeAlerts(raw) {
		if (!Array.isArray(raw)) return [];
		return raw.map((a) => ({
			code: _str$1(a.code),
			severity: _str$1(a.severity),
			message: _str$1(a.message),
			targetType: _str$1(a.targetType),
			targetId: _str$1(a.targetId),
			metadata: a.metadata && typeof a.metadata === "object" && !Array.isArray(a.metadata) ? Object.assign({}, a.metadata) : {}
		}));
	}
	function _normalizeStatementMetadata(raw) {
		if (!raw || typeof raw !== "object") return {};
		return {
			generatedAt: _num(raw.generatedAt),
			status: _str$1(raw.status),
			source: _str$1(raw.source)
		};
	}
	var EnergyCreditsReadModel = class {
		constructor() {
			this._generatingUnits = /* @__PURE__ */ new Map();
			this._beneficiaryUnits = /* @__PURE__ */ new Map();
			this._generatingUnitMonthlyRecords = /* @__PURE__ */ new Map();
			this._beneficiaryMonthlyRecords = /* @__PURE__ */ new Map();
			this._creditAllocations = /* @__PURE__ */ new Map();
			this._ownerSettlements = /* @__PURE__ */ new Map();
			this._esaInvoices = /* @__PURE__ */ new Map();
			this._monthlyStatements = /* @__PURE__ */ new Map();
			this._beneficiaryCreditBalanceRecords = /* @__PURE__ */ new Map();
			this._hydrationCount = 0;
			this._lastHydration = null;
		}
		hydrate(snapshot = {}, options = {}) {
			const { replace = true, referenceDate } = options;
			if (replace) this.clear();
			let received = 0;
			let hydrated = 0;
			let skipped = 0;
			const run = (raw, fn) => {
				for (const item of _toArray(raw)) {
					received++;
					if (fn(item)) hydrated++;
					else skipped++;
				}
			};
			run(snapshot.generatingUnits, this.upsertGeneratingUnit.bind(this));
			run(snapshot.beneficiaryUnits, this.upsertBeneficiaryUnit.bind(this));
			run(snapshot.generatingUnitMonthlyRecords, this.upsertGeneratingUnitMonthlyRecord.bind(this));
			run(snapshot.beneficiaryMonthlyRecords, this.upsertBeneficiaryMonthlyRecord.bind(this));
			run(snapshot.creditAllocations, this.upsertCreditAllocation.bind(this));
			run(snapshot.ownerSettlements, this.upsertOwnerSettlement.bind(this));
			run(snapshot.esaInvoices, this.upsertEsaInvoice.bind(this));
			run(snapshot.monthlyStatements, this.upsertMonthlyStatement.bind(this));
			run(snapshot.beneficiaryCreditBalanceRecords, this.upsertBeneficiaryCreditBalanceRecord.bind(this));
			this._hydrationCount++;
			const result = {
				received,
				hydrated,
				skipped,
				replaced: replace,
				referenceDate: referenceDate || null
			};
			this._lastHydration = result;
			return result;
		}
		clear() {
			this._generatingUnits.clear();
			this._beneficiaryUnits.clear();
			this._generatingUnitMonthlyRecords.clear();
			this._beneficiaryMonthlyRecords.clear();
			this._creditAllocations.clear();
			this._ownerSettlements.clear();
			this._esaInvoices.clear();
			this._monthlyStatements.clear();
			this._beneficiaryCreditBalanceRecords.clear();
			this._lastHydration = null;
			this._hydrationCount = 0;
		}
		getStats() {
			return {
				generatingUnitCount: this._generatingUnits.size,
				beneficiaryUnitCount: this._beneficiaryUnits.size,
				generatingUnitMonthlyRecordCount: this._generatingUnitMonthlyRecords.size,
				beneficiaryMonthlyRecordCount: this._beneficiaryMonthlyRecords.size,
				creditAllocationCount: this._creditAllocations.size,
				ownerSettlementCount: this._ownerSettlements.size,
				esaInvoiceCount: this._esaInvoices.size,
				monthlyStatementCount: this._monthlyStatements.size,
				beneficiaryCreditBalanceRecordCount: this._beneficiaryCreditBalanceRecords.size,
				hydrationCount: this._hydrationCount,
				lastHydration: this._lastHydration ? Object.assign({}, this._lastHydration) : null
			};
		}
		upsertGeneratingUnit(unit) {
			if (!unit || typeof unit !== "object") return false;
			const id = _str$1(unit.id);
			if (!id || !id.trim()) return false;
			this._generatingUnits.set(id, this._normalizeGeneratingUnit(unit));
			return true;
		}
		_normalizeGeneratingUnit(u) {
			return {
				id: _str$1(u.id),
				name: _str$1(u.name),
				ownerName: _str$1(u.ownerName),
				ownerDocument: _str$1(u.ownerDocument),
				uc: _str$1(u.uc),
				address: _str$1(u.address),
				city: _str$1(u.city),
				state: _str$1(u.state),
				utilityCompany: _str$1(u.utilityCompany),
				pixKey: _str$1(u.pixKey),
				installedPower: _num(u.installedPower),
				operationalStatus: _str$1(u.operationalStatus),
				startedAt: _num(u.startedAt),
				notes: _str$1(u.notes)
			};
		}
		upsertBeneficiaryUnit(unit) {
			if (!unit || typeof unit !== "object") return false;
			const id = _str$1(unit.id);
			if (!id || !id.trim()) return false;
			this._beneficiaryUnits.set(id, this._normalizeBeneficiaryUnit(unit));
			return true;
		}
		_normalizeBeneficiaryUnit(u) {
			return {
				id: _str$1(u.id),
				generatingUnitId: _str$1(u.generatingUnitId),
				name: _str$1(u.name),
				holderName: _str$1(u.holderName),
				uc: _str$1(u.uc),
				address: _str$1(u.address),
				city: _str$1(u.city),
				state: _str$1(u.state),
				utilityCompany: _str$1(u.utilityCompany),
				subscriptionStatus: _str$1(u.subscriptionStatus),
				averageConsumption12Months: _num(u.averageConsumption12Months),
				startedAt: _num(u.startedAt),
				notes: _str$1(u.notes)
			};
		}
		upsertGeneratingUnitMonthlyRecord(record) {
			if (!record || typeof record !== "object") return false;
			const gid = _str$1(record.generatingUnitId);
			const month = _str$1(record.referenceMonth);
			if (!gid || !month || !MONTH_RE$2.test(month)) return false;
			const key = _str$1(record.id) || `${gid}::${month}`;
			this._generatingUnitMonthlyRecords.set(key, this._normalizeGenRecord(record));
			return true;
		}
		_normalizeGenRecord(r) {
			return {
				id: _str$1(r.id),
				generatingUnitId: _str$1(r.generatingUnitId),
				referenceMonth: _str$1(r.referenceMonth),
				purchaseKwhPrice: _num(r.purchaseKwhPrice),
				previousAccumulatedKwhBalance: _num(r.previousAccumulatedKwhBalance),
				monthlyGenerationKwh: _num(r.monthlyGenerationKwh),
				availableKwhBeforeAllocation: _num(r.availableKwhBeforeAllocation),
				consumedAllocatedKwh: _num(r.consumedAllocatedKwh),
				currentAccumulatedKwhBalance: _num(r.currentAccumulatedKwhBalance),
				monthlyOwnerReturn: _num(r.monthlyOwnerReturn),
				accumulatedOwnerReturn: _num(r.accumulatedOwnerReturn),
				status: _str$1(r.status),
				notes: _str$1(r.notes)
			};
		}
		upsertBeneficiaryMonthlyRecord(record) {
			if (!record || typeof record !== "object") return false;
			const bid = _str$1(record.beneficiaryUnitId);
			const month = _str$1(record.referenceMonth);
			if (!bid || !month || !MONTH_RE$2.test(month)) return false;
			const key = _str$1(record.id) || `${bid}::${month}`;
			this._beneficiaryMonthlyRecords.set(key, this._normalizeBenRecord(record));
			return true;
		}
		_normalizeBenRecord(r) {
			return {
				id: _str$1(r.id),
				beneficiaryUnitId: _str$1(r.beneficiaryUnitId),
				generatingUnitId: _str$1(r.generatingUnitId),
				referenceMonth: _str$1(r.referenceMonth),
				monthlyConsumptionKwh: _num(r.monthlyConsumptionKwh),
				allocatedKwh: _num(r.allocatedKwh),
				compensatedKwh: _num(r.compensatedKwh),
				pendingKwh: _num(r.pendingKwh),
				residualKwh: _num(r.residualKwh),
				esaKwhPrice: _num(r.esaKwhPrice),
				utilityReferenceTariff: _num(r.utilityReferenceTariff),
				billWithoutEsa: _num(r.billWithoutEsa),
				esaInvoiceAmount: _num(r.esaInvoiceAmount),
				residualUtilityAmount: _num(r.residualUtilityAmount),
				billWithEsa: _num(r.billWithEsa),
				monthlyDiscount: _num(r.monthlyDiscount),
				previousAccumulatedDiscount: _num(r.previousAccumulatedDiscount),
				accumulatedDiscountTotal: _num(r.accumulatedDiscountTotal),
				paymentStatus: _str$1(r.paymentStatus),
				dueDate: _num(r.dueDate),
				paidAt: _num(r.paidAt),
				notes: _str$1(r.notes)
			};
		}
		upsertCreditAllocation(alloc) {
			if (!alloc || typeof alloc !== "object") return false;
			const id = _str$1(alloc.id);
			if (!id || !id.trim()) return false;
			this._creditAllocations.set(id, this._normalizeAllocation(alloc));
			return true;
		}
		_normalizeAllocation(a) {
			return {
				id: _str$1(a.id),
				generatingUnitId: _str$1(a.generatingUnitId),
				beneficiaryUnitId: _str$1(a.beneficiaryUnitId),
				referenceMonth: _str$1(a.referenceMonth),
				allocatedKwh: _num(a.allocatedKwh),
				compensatedKwh: _num(a.compensatedKwh),
				pendingKwh: _num(a.pendingKwh),
				status: _str$1(a.status)
			};
		}
		upsertOwnerSettlement(settlement) {
			if (!settlement || typeof settlement !== "object") return false;
			const gid = _str$1(settlement.generatingUnitId);
			const month = _str$1(settlement.referenceMonth);
			if (!gid || !month || !MONTH_RE$2.test(month)) return false;
			const key = _str$1(settlement.id) || `${gid}::${month}`;
			this._ownerSettlements.set(key, this._normalizeSettlement(settlement));
			return true;
		}
		_normalizeSettlement(s) {
			return {
				id: _str$1(s.id),
				generatingUnitId: _str$1(s.generatingUnitId),
				ownerName: _str$1(s.ownerName),
				referenceMonth: _str$1(s.referenceMonth),
				consumedAllocatedKwh: _num(s.consumedAllocatedKwh),
				purchaseKwhPrice: _num(s.purchaseKwhPrice),
				grossReturn: _num(s.grossReturn),
				adjustments: _num(s.adjustments),
				netReturn: _num(s.netReturn),
				paymentStatus: _str$1(s.paymentStatus),
				dueDate: _num(s.dueDate),
				paidAt: _num(s.paidAt)
			};
		}
		upsertEsaInvoice(invoice) {
			if (!invoice || typeof invoice !== "object") return false;
			const bid = _str$1(invoice.beneficiaryUnitId);
			const month = _str$1(invoice.referenceMonth);
			if (!bid || !month || !MONTH_RE$2.test(month)) return false;
			const key = _str$1(invoice.id) || `${bid}::${month}`;
			this._esaInvoices.set(key, this._normalizeInvoice(invoice));
			return true;
		}
		_normalizeInvoice(inv) {
			return {
				id: _str$1(inv.id),
				beneficiaryUnitId: _str$1(inv.beneficiaryUnitId),
				referenceMonth: _str$1(inv.referenceMonth),
				consumedKwh: _num(inv.consumedKwh),
				compensatedKwh: _num(inv.compensatedKwh),
				esaKwhPrice: _num(inv.esaKwhPrice),
				invoiceAmount: _num(inv.invoiceAmount),
				paymentStatus: _str$1(inv.paymentStatus),
				dueDate: _num(inv.dueDate),
				paidAt: _num(inv.paidAt)
			};
		}
		upsertMonthlyStatement(statement) {
			if (!statement || typeof statement !== "object") return false;
			const gid = _str$1(statement.generatingUnitId);
			const month = _str$1(statement.referenceMonth);
			if (!gid || !month || !MONTH_RE$2.test(month)) return false;
			const key = `${gid}::${month}`;
			this._monthlyStatements.set(key, this._normalizeStatement(statement));
			return true;
		}
		_normalizeStatement(s) {
			return {
				referenceMonth: _str$1(s.referenceMonth),
				generatingUnitId: _str$1(s.generatingUnitId),
				totalGenerationKwh: _num(s.totalGenerationKwh),
				previousBalanceKwh: _num(s.previousBalanceKwh),
				availableKwhBeforeAllocation: _num(s.availableKwhBeforeAllocation),
				totalAllocatedKwh: _num(s.totalAllocatedKwh),
				totalCompensatedKwh: _num(s.totalCompensatedKwh),
				totalPendingKwh: _num(s.totalPendingKwh),
				totalResidualKwh: _num(s.totalResidualKwh),
				currentBalanceKwh: _num(s.currentBalanceKwh),
				totalOwnerReturn: _num(s.totalOwnerReturn),
				totalEsaRevenue: _num(s.totalEsaRevenue),
				grossSpread: _num(s.grossSpread),
				beneficiaryCount: _num(s.beneficiaryCount),
				alerts: _normalizeAlerts(s.alerts),
				metadata: _normalizeStatementMetadata(s.metadata)
			};
		}
		getGeneratingUnit(id) {
			const unit = this._generatingUnits.get(String(id));
			return unit ? Object.assign({}, unit) : null;
		}
		getBeneficiaryUnit(id) {
			const unit = this._beneficiaryUnits.get(String(id));
			return unit ? Object.assign({}, unit) : null;
		}
		getMonthlyStatement(generatingUnitId, referenceMonth) {
			const key = `${generatingUnitId}::${referenceMonth}`;
			const stmt = this._monthlyStatements.get(key);
			return stmt ? Object.assign({}, stmt) : null;
		}
		listGeneratingUnits(filters = {}) {
			let items = Array.from(this._generatingUnits.values()).map((u) => Object.assign({}, u));
			if (filters.utilityCompany != null) items = items.filter((u) => u.utilityCompany === filters.utilityCompany);
			if (filters.operationalStatus != null) items = items.filter((u) => u.operationalStatus === filters.operationalStatus);
			items.sort((a, b) => (a.id || "").localeCompare(b.id || ""));
			return items;
		}
		listBeneficiaryUnits(filters = {}) {
			let items = Array.from(this._beneficiaryUnits.values()).map((u) => Object.assign({}, u));
			if (filters.generatingUnitId != null) items = items.filter((u) => u.generatingUnitId === filters.generatingUnitId);
			if (filters.utilityCompany != null) items = items.filter((u) => u.utilityCompany === filters.utilityCompany);
			if (filters.subscriptionStatus != null) items = items.filter((u) => u.subscriptionStatus === filters.subscriptionStatus);
			items.sort((a, b) => (a.id || "").localeCompare(b.id || ""));
			return items;
		}
		listGeneratingUnitMonthlyRecords(filters = {}) {
			let items = Array.from(this._generatingUnitMonthlyRecords.values()).map((r) => Object.assign({}, r));
			items = _applyMonthFilter(items, filters);
			if (filters.generatingUnitId != null) items = items.filter((r) => r.generatingUnitId === filters.generatingUnitId);
			if (filters.status != null) items = items.filter((r) => r.status === filters.status);
			items.sort((a, b) => (a.referenceMonth || "").localeCompare(b.referenceMonth || ""));
			return items;
		}
		listBeneficiaryMonthlyRecords(filters = {}) {
			let items = Array.from(this._beneficiaryMonthlyRecords.values()).map((r) => Object.assign({}, r));
			items = _applyMonthFilter(items, filters);
			if (filters.generatingUnitId != null) items = items.filter((r) => r.generatingUnitId === filters.generatingUnitId);
			if (filters.beneficiaryUnitId != null) items = items.filter((r) => r.beneficiaryUnitId === filters.beneficiaryUnitId);
			if (filters.paymentStatus != null) items = items.filter((r) => r.paymentStatus === filters.paymentStatus);
			items.sort((a, b) => (a.referenceMonth || "").localeCompare(b.referenceMonth || ""));
			return items;
		}
		listCreditAllocations(filters = {}) {
			let items = Array.from(this._creditAllocations.values()).map((a) => Object.assign({}, a));
			items = _applyMonthFilter(items, filters);
			if (filters.generatingUnitId != null) items = items.filter((a) => a.generatingUnitId === filters.generatingUnitId);
			if (filters.beneficiaryUnitId != null) items = items.filter((a) => a.beneficiaryUnitId === filters.beneficiaryUnitId);
			if (filters.status != null) items = items.filter((a) => a.status === filters.status);
			return items;
		}
		listOwnerSettlements(filters = {}) {
			let items = Array.from(this._ownerSettlements.values()).map((s) => Object.assign({}, s));
			items = _applyMonthFilter(items, filters);
			if (filters.generatingUnitId != null) items = items.filter((s) => s.generatingUnitId === filters.generatingUnitId);
			if (filters.paymentStatus != null) items = items.filter((s) => s.paymentStatus === filters.paymentStatus);
			items.sort((a, b) => (a.referenceMonth || "").localeCompare(b.referenceMonth || ""));
			return items;
		}
		listEsaInvoices(filters = {}) {
			let items = Array.from(this._esaInvoices.values()).map((i) => Object.assign({}, i));
			items = _applyMonthFilter(items, filters);
			if (filters.beneficiaryUnitId != null) items = items.filter((i) => i.beneficiaryUnitId === filters.beneficiaryUnitId);
			if (filters.paymentStatus != null) items = items.filter((i) => i.paymentStatus === filters.paymentStatus);
			items.sort((a, b) => (a.referenceMonth || "").localeCompare(b.referenceMonth || ""));
			return items;
		}
		listMonthlyStatements(filters = {}) {
			let items = Array.from(this._monthlyStatements.values()).map((s) => Object.assign({}, s));
			items = _applyMonthFilter(items, filters);
			if (filters.generatingUnitId != null) items = items.filter((s) => s.generatingUnitId === filters.generatingUnitId);
			if (filters.status != null) items = items.filter((s) => (s.metadata && s.metadata.status) === filters.status);
			items.sort((a, b) => (a.referenceMonth || "").localeCompare(b.referenceMonth || ""));
			return items;
		}
		upsertBeneficiaryCreditBalanceRecord(record) {
			if (!record || typeof record !== "object") return false;
			const bid = _str$1(record.beneficiaryUnitId);
			const month = _str$1(record.referenceMonth);
			if (!bid || !month || !MONTH_RE$2.test(month)) return false;
			const key = _str$1(record.id) || `beneficiary-credit-balance-${bid}-${month}`;
			this._beneficiaryCreditBalanceRecords.set(key, this._normalizeBalanceRecord(record));
			return true;
		}
		_normalizeBalanceRecord(r) {
			return {
				id: _str$1(r.id),
				beneficiaryUnitId: _str$1(r.beneficiaryUnitId),
				generatingUnitId: _str$1(r.generatingUnitId),
				beneficiaryUc: _str$1(r.beneficiaryUc),
				referenceMonth: _str$1(r.referenceMonth),
				previousBalanceKwh: _num(r.previousBalanceKwh),
				creditsReceivedKwh: _num(r.creditsReceivedKwh),
				creditsCompensatedKwh: _num(r.creditsCompensatedKwh),
				positiveAdjustmentsKwh: _num(r.positiveAdjustmentsKwh),
				negativeAdjustmentsKwh: _num(r.negativeAdjustmentsKwh),
				currentBalanceKwh: _num(r.currentBalanceKwh),
				averageMonthlyConsumptionKwh: _num(r.averageMonthlyConsumptionKwh),
				preventiveMarginPercentage: _num(r.preventiveMarginPercentage),
				targetCreditKwh: _num(r.targetCreditKwh),
				allocationPercentage: _num(r.allocationPercentage),
				coverageMonths: _num(r.coverageMonths),
				status: _str$1(r.status),
				alerts: Array.isArray(r.alerts) ? r.alerts.map((a) => ({
					code: _str$1(a.code),
					severity: _str$1(a.severity),
					message: _str$1(a.message)
				})) : [],
				metadata: r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata) ? Object.assign({}, r.metadata) : {}
			};
		}
		getBeneficiaryCreditBalanceRecord(id) {
			const rec = this._beneficiaryCreditBalanceRecords.get(String(id));
			return rec ? Object.assign({}, rec) : null;
		}
		listBeneficiaryCreditBalanceRecords(filters = {}) {
			let items = Array.from(this._beneficiaryCreditBalanceRecords.values()).map((r) => Object.assign({}, r));
			items = _applyMonthFilter(items, filters);
			if (filters.beneficiaryUnitId != null) items = items.filter((r) => r.beneficiaryUnitId === filters.beneficiaryUnitId);
			if (filters.generatingUnitId != null) items = items.filter((r) => r.generatingUnitId === filters.generatingUnitId);
			if (filters.status != null) items = items.filter((r) => r.status === filters.status);
			items.sort((a, b) => (a.referenceMonth || "").localeCompare(b.referenceMonth || ""));
			return items;
		}
	};
	//#endregion
	//#region ../../../read-models/energy-credits/index.js
	var energyCreditsReadModel = new EnergyCreditsReadModel();
	//#endregion
	//#region ../../../queries/energy-credits/energy-credits-query-result.js
	/**
	* ESA OS — Energy Domain / Credits
	* EnergyCreditsQueryResult
	*
	* Envelope de resposta para queries de créditos.
	* generatedAt vem do options.referenceDate, nunca de Date.now().
	*/
	var EnergyCreditsQueryResult = class {
		constructor(data, metadata = {}, referenceDate = null) {
			this.data = data;
			this.metadata = metadata;
			this.generatedAt = referenceDate !== null && referenceDate !== void 0 ? referenceDate : null;
		}
		toJSON() {
			let data;
			if (Array.isArray(this.data)) data = this.data.slice();
			else if (this.data !== null && this.data !== void 0 && typeof this.data === "object") data = Object.assign({}, this.data);
			else data = this.data;
			return {
				data,
				metadata: Object.assign({}, this.metadata),
				generatedAt: this.generatedAt
			};
		}
	};
	//#endregion
	//#region ../../../queries/energy-credits/energy-credits-query-service.js
	/**
	* ESA OS — Energy Domain / Credits
	* EnergyCreditsQueryService
	*
	* 12 queries sobre o EnergyCreditsReadModel.
	* Sem estado próprio. Sem Firebase. Sem efeitos colaterais.
	*/
	function _sum(items, field) {
		return items.reduce((acc, item) => {
			const v = item[field];
			return acc + (typeof v === "number" && !isNaN(v) ? v : 0);
		}, 0);
	}
	function _latestPerBeneficiary(records) {
		const map = /* @__PURE__ */ new Map();
		for (const r of records) {
			const bid = r.beneficiaryUnitId;
			const existing = map.get(bid);
			if (!existing || (r.referenceMonth || "") > (existing.referenceMonth || "")) map.set(bid, r);
		}
		return Array.from(map.values());
	}
	var SEV_ORDER = [
		"critical",
		"risk",
		"attention",
		"info"
	];
	function _sortAlerts(alerts) {
		return [...alerts].sort((a, b) => {
			const si = SEV_ORDER.indexOf(a.severity) - SEV_ORDER.indexOf(b.severity);
			if (si !== 0) return si;
			const ci = (a.code || "").localeCompare(b.code || "");
			if (ci !== 0) return ci;
			return (a.targetId || "").localeCompare(b.targetId || "");
		});
	}
	var EnergyCreditsQueryService = class {
		constructor(readModel) {
			this._rm = readModel || null;
			this._avgCalc = new BeneficiaryConsumptionAverageCalculator();
		}
		_requireReadModel(queryName) {
			if (!this._rm || typeof this._rm.listGeneratingUnits !== "function") throw new TypeError(`[EnergyCreditsQueryService.${queryName}] readModel inválido`);
		}
		_result(data, metadata, options = {}) {
			return new EnergyCreditsQueryResult(data, metadata, options.referenceDate || null);
		}
		getGeneratingUnit(id, options = {}) {
			this._requireReadModel("getGeneratingUnit");
			const unit = this._rm.getGeneratingUnit(id);
			return this._result(unit, {
				query: "ec.getGeneratingUnit",
				id
			}, options);
		}
		getBeneficiaryUnit(id, options = {}) {
			this._requireReadModel("getBeneficiaryUnit");
			const unit = this._rm.getBeneficiaryUnit(id);
			return this._result(unit, {
				query: "ec.getBeneficiaryUnit",
				id
			}, options);
		}
		searchGeneratingUnits(filters = {}, options = {}) {
			this._requireReadModel("searchGeneratingUnits");
			const units = this._rm.listGeneratingUnits(filters);
			return this._result(units, {
				query: "ec.searchGeneratingUnits",
				filters: Object.assign({}, filters),
				count: units.length
			}, options);
		}
		searchBeneficiaryUnits(filters = {}, options = {}) {
			this._requireReadModel("searchBeneficiaryUnits");
			const units = this._rm.listBeneficiaryUnits(filters);
			return this._result(units, {
				query: "ec.searchBeneficiaryUnits",
				filters: Object.assign({}, filters),
				count: units.length
			}, options);
		}
		getMonthlyStatement(generatingUnitId, referenceMonth, options = {}) {
			this._requireReadModel("getMonthlyStatement");
			const stmt = this._rm.getMonthlyStatement(generatingUnitId, referenceMonth);
			return this._result(stmt, {
				query: "ec.getMonthlyStatement",
				generatingUnitId,
				referenceMonth
			}, options);
		}
		getGeneratingUnitMonthlyHistory(generatingUnitId, filters = {}, options = {}) {
			this._requireReadModel("getGeneratingUnitMonthlyHistory");
			const recs = this._rm.listGeneratingUnitMonthlyRecords({
				...filters,
				generatingUnitId
			});
			return this._result(recs, {
				query: "ec.getGeneratingUnitMonthlyHistory",
				generatingUnitId,
				filters: Object.assign({}, filters),
				count: recs.length
			}, options);
		}
		getBeneficiaryMonthlyHistory(beneficiaryUnitId, filters = {}, options = {}) {
			this._requireReadModel("getBeneficiaryMonthlyHistory");
			const recs = this._rm.listBeneficiaryMonthlyRecords({
				...filters,
				beneficiaryUnitId
			});
			return this._result(recs, {
				query: "ec.getBeneficiaryMonthlyHistory",
				beneficiaryUnitId,
				filters: Object.assign({}, filters),
				count: recs.length
			}, options);
		}
		getExecutiveSummary(filters = {}, options = {}) {
			this._requireReadModel("getExecutiveSummary");
			const data = this._buildExecutiveSummary(filters, options);
			return this._result(data, {
				query: "ec.getExecutiveSummary",
				filters: Object.assign({}, filters)
			}, options);
		}
		getGeneratingUnitSummary(generatingUnitId, filters = {}, options = {}) {
			this._requireReadModel("getGeneratingUnitSummary");
			const data = this._buildGeneratingUnitSummary(generatingUnitId, filters, options);
			return this._result(data, {
				query: "ec.getGeneratingUnitSummary",
				generatingUnitId,
				filters: Object.assign({}, filters)
			}, options);
		}
		getBeneficiarySummary(beneficiaryUnitId, filters = {}, options = {}) {
			this._requireReadModel("getBeneficiarySummary");
			const data = this._buildBeneficiarySummary(beneficiaryUnitId, filters, options);
			return this._result(data, {
				query: "ec.getBeneficiarySummary",
				beneficiaryUnitId,
				filters: Object.assign({}, filters)
			}, options);
		}
		getFinancialSummary(filters = {}, options = {}) {
			this._requireReadModel("getFinancialSummary");
			const data = this._buildFinancialSummary(filters, options);
			return this._result(data, {
				query: "ec.getFinancialSummary",
				filters: Object.assign({}, filters)
			}, options);
		}
		getAlertsSummary(filters = {}, options = {}) {
			this._requireReadModel("getAlertsSummary");
			const data = this._buildAlertsSummary(filters, options);
			return this._result(data, {
				query: "ec.getAlertsSummary",
				filters: Object.assign({}, filters)
			}, options);
		}
		getBeneficiaryCreditBalance(beneficiaryUnitId, referenceMonth, options = {}) {
			this._requireReadModel("getBeneficiaryCreditBalance");
			const id = `beneficiary-credit-balance-${beneficiaryUnitId}-${referenceMonth}`;
			const record = this._rm.getBeneficiaryCreditBalanceRecord ? this._rm.getBeneficiaryCreditBalanceRecord(id) : null;
			return this._result(record, {
				query: "ec.getBeneficiaryCreditBalance",
				beneficiaryUnitId,
				referenceMonth
			}, options);
		}
		getBeneficiaryCreditBalanceHistory(beneficiaryUnitId, filters = {}, options = {}) {
			this._requireReadModel("getBeneficiaryCreditBalanceHistory");
			const records = this._rm.listBeneficiaryCreditBalanceRecords ? this._rm.listBeneficiaryCreditBalanceRecords({
				...filters,
				beneficiaryUnitId
			}) : [];
			return this._result(records, {
				query: "ec.getBeneficiaryCreditBalanceHistory",
				beneficiaryUnitId,
				filters: Object.assign({}, filters),
				count: records.length
			}, options);
		}
		getCreditAllocationPlan(generatingUnitId, referenceMonth, options = {}) {
			this._requireReadModel("getCreditAllocationPlan");
			const sorted = [...this._rm.listBeneficiaryCreditBalanceRecords ? this._rm.listBeneficiaryCreditBalanceRecords({
				generatingUnitId,
				referenceMonth
			}) : []].sort((a, b) => (a.beneficiaryUnitId || "").localeCompare(b.beneficiaryUnitId || ""));
			const plan = {
				generatingUnitId,
				referenceMonth,
				beneficiaryCount: sorted.length,
				totalPlannedCreditsKwh: roundKwh(sorted.reduce((s, r) => s + (r.creditsReceivedKwh || 0), 0)),
				beneficiaries: sorted
			};
			return this._result(plan, {
				query: "ec.getCreditAllocationPlan",
				generatingUnitId,
				referenceMonth
			}, options);
		}
		getBeneficiaryConsumptionAverage(beneficiaryUnitId, filters = {}, options = {}) {
			this._requireReadModel("getBeneficiaryConsumptionAverage");
			const history = this._rm.listBeneficiaryMonthlyRecords({
				...filters,
				beneficiaryUnitId
			}).map((r) => ({
				referenceMonth: r.referenceMonth,
				consumptionKwh: r.monthlyConsumptionKwh
			}));
			const calcResult = this._avgCalc.calculate({
				beneficiaryUnitId,
				monthlyConsumptionHistory: history,
				options: {
					monthWindow: filters.monthWindow || 12,
					referenceMonth: filters.referenceMonth || null
				}
			});
			const data = calcResult.ok ? calcResult.data : null;
			return this._result(data, {
				query: "ec.getBeneficiaryConsumptionAverage",
				beneficiaryUnitId
			}, options);
		}
		_buildExecutiveSummary(filters) {
			const statements = this._rm.listMonthlyStatements(filters);
			const genUnits = this._rm.listGeneratingUnits({});
			const benUnits = this._rm.listBeneficiaryUnits({});
			const benRecs = this._rm.listBeneficiaryMonthlyRecords(filters);
			const invoices = this._rm.listEsaInvoices(filters);
			const allAlerts = statements.flatMap((s) => Array.isArray(s.alerts) ? s.alerts : []);
			const latest = _latestPerBeneficiary(benRecs);
			const months = [...new Set(statements.map((s) => s.referenceMonth))].sort();
			return {
				generatingUnitCount: genUnits.length,
				beneficiaryUnitCount: benUnits.length,
				totalGenerationKwh: roundKwh(_sum(statements, "totalGenerationKwh")),
				totalAllocatedKwh: roundKwh(_sum(statements, "totalAllocatedKwh")),
				totalCompensatedKwh: roundKwh(_sum(statements, "totalCompensatedKwh")),
				totalPendingKwh: roundKwh(_sum(statements, "totalPendingKwh")),
				totalCurrentBalanceKwh: roundKwh(_sum(statements, "currentBalanceKwh")),
				totalOwnerReturn: roundMoney(_sum(statements, "totalOwnerReturn")),
				totalEsaRevenue: roundMoney(_sum(statements, "totalEsaRevenue")),
				grossSpread: roundMoney(_sum(statements, "grossSpread")),
				totalMonthlyDiscount: roundMoney(_sum(benRecs, "monthlyDiscount")),
				totalAccumulatedDiscount: roundMoney(_sum(latest, "accumulatedDiscountTotal")),
				delinquentInvoiceCount: invoices.filter((i) => i.paymentStatus === "overdue").length,
				alertCount: allAlerts.length,
				criticalAlertCount: allAlerts.filter((a) => a.severity === "critical").length,
				riskAlertCount: allAlerts.filter((a) => a.severity === "risk").length,
				referenceMonths: months
			};
		}
		_buildGeneratingUnitSummary(generatingUnitId, filters) {
			const unit = this._rm.getGeneratingUnit(generatingUnitId);
			const benUnits = this._rm.listBeneficiaryUnits({ generatingUnitId });
			const statements = this._rm.listMonthlyStatements({
				...filters,
				generatingUnitId
			});
			const allAlerts = statements.flatMap((s) => Array.isArray(s.alerts) ? s.alerts : []);
			const lastStmt = statements.length > 0 ? statements[statements.length - 1] : null;
			return {
				generatingUnit: unit,
				beneficiaryCount: benUnits.length,
				monthlyStatementCount: statements.length,
				totalGenerationKwh: roundKwh(_sum(statements, "totalGenerationKwh")),
				totalAllocatedKwh: roundKwh(_sum(statements, "totalAllocatedKwh")),
				totalCompensatedKwh: roundKwh(_sum(statements, "totalCompensatedKwh")),
				currentBalanceKwh: lastStmt ? lastStmt.currentBalanceKwh || 0 : 0,
				totalOwnerReturn: roundMoney(_sum(statements, "totalOwnerReturn")),
				grossSpread: roundMoney(_sum(statements, "grossSpread")),
				alerts: allAlerts,
				lastStatement: lastStmt
			};
		}
		_buildBeneficiarySummary(beneficiaryUnitId, filters) {
			const unit = this._rm.getBeneficiaryUnit(beneficiaryUnitId);
			const records = this._rm.listBeneficiaryMonthlyRecords({
				...filters,
				beneficiaryUnitId
			});
			const lastRec = records.length > 0 ? records[records.length - 1] : null;
			const balRecs = this._rm.listBeneficiaryCreditBalanceRecords ? this._rm.listBeneficiaryCreditBalanceRecords({ beneficiaryUnitId }) : [];
			const lastBal = balRecs.length > 0 ? balRecs[balRecs.length - 1] : null;
			const paymentStatusSummary = {};
			for (const r of records) {
				const s = r.paymentStatus || "unknown";
				paymentStatusSummary[s] = (paymentStatusSummary[s] || 0) + 1;
			}
			return {
				beneficiaryUnit: unit,
				monthlyRecordCount: records.length,
				totalConsumptionKwh: roundKwh(_sum(records, "monthlyConsumptionKwh")),
				totalAllocatedKwh: roundKwh(_sum(records, "allocatedKwh")),
				totalCompensatedKwh: roundKwh(_sum(records, "compensatedKwh")),
				totalResidualKwh: roundKwh(_sum(records, "residualKwh")),
				totalEsaInvoiceAmount: roundMoney(_sum(records, "esaInvoiceAmount")),
				totalBillWithoutEsa: roundMoney(_sum(records, "billWithoutEsa")),
				totalBillWithEsa: roundMoney(_sum(records, "billWithEsa")),
				totalMonthlyDiscount: roundMoney(_sum(records, "monthlyDiscount")),
				accumulatedDiscountTotal: lastRec ? lastRec.accumulatedDiscountTotal || 0 : 0,
				paymentStatusSummary,
				lastMonthlyRecord: lastRec,
				averageMonthlyConsumptionKwh: lastBal ? lastBal.averageMonthlyConsumptionKwh : unit ? unit.averageConsumption12Months : null,
				currentCreditBalanceKwh: lastBal ? lastBal.currentBalanceKwh : null,
				coverageMonths: lastBal ? lastBal.coverageMonths : null,
				preventiveMarginPercentage: lastBal ? lastBal.preventiveMarginPercentage : null,
				allocationPercentage: lastBal ? lastBal.allocationPercentage : null
			};
		}
		_buildFinancialSummary(filters) {
			const invoices = this._rm.listEsaInvoices(filters);
			const settlements = this._rm.listOwnerSettlements(filters);
			const statements = this._rm.listMonthlyStatements(filters);
			const paid = invoices.filter((i) => i.paymentStatus === "paid");
			const open = invoices.filter((i) => i.paymentStatus === "pending");
			const overdue = invoices.filter((i) => i.paymentStatus === "overdue");
			const spaid = settlements.filter((s) => s.paymentStatus === "paid");
			const sopen = settlements.filter((s) => s.paymentStatus === "pending");
			return {
				totalEsaRevenue: roundMoney(_sum(statements, "totalEsaRevenue")),
				totalOwnerReturn: roundMoney(_sum(statements, "totalOwnerReturn")),
				grossSpread: roundMoney(_sum(statements, "grossSpread")),
				totalInvoices: invoices.length,
				paidInvoices: paid.length,
				openInvoices: open.length,
				overdueInvoices: overdue.length,
				totalInvoicedAmount: roundMoney(_sum(invoices, "invoiceAmount")),
				totalPaidAmount: roundMoney(_sum(paid, "invoiceAmount")),
				totalOpenAmount: roundMoney(_sum(open, "invoiceAmount")),
				totalOwnerSettlements: settlements.length,
				paidOwnerSettlements: spaid.length,
				openOwnerSettlements: sopen.length,
				totalOwnerSettlementAmount: roundMoney(_sum(settlements, "netReturn")),
				totalOwnerSettlementOpenAmount: roundMoney(_sum(sopen, "netReturn"))
			};
		}
		_buildAlertsSummary(filters) {
			const sorted = _sortAlerts(this._rm.listMonthlyStatements(filters).flatMap((s) => Array.isArray(s.alerts) ? s.alerts : []));
			const bySeverity = {};
			const byCode = {};
			for (const a of sorted) {
				bySeverity[a.severity] = (bySeverity[a.severity] || 0) + 1;
				byCode[a.code] = (byCode[a.code] || 0) + 1;
			}
			return {
				totalAlerts: sorted.length,
				bySeverity,
				byCode,
				criticalAlerts: sorted.filter((a) => a.severity === "critical"),
				riskAlerts: sorted.filter((a) => a.severity === "risk"),
				attentionAlerts: sorted.filter((a) => a.severity === "attention"),
				infoAlerts: sorted.filter((a) => a.severity === "info"),
				alerts: sorted
			};
		}
	};
	//#endregion
	//#region ../../../queries/energy-credits/index.js
	var energyCreditsQueryService = new EnergyCreditsQueryService(energyCreditsReadModel);
	//#endregion
	//#region ../../../reports/energy-credits/report-types.js
	/** Tipos de relatório estáveis — usados em reportType do contrato. */
	var REPORT_TYPE = Object.freeze({
		OWNER_MONTHLY: "owner-monthly",
		BENEFICIARY_MONTHLY: "beneficiary-monthly",
		ESA_INTERNAL_MONTHLY: "esa-internal-monthly",
		ESA_FINANCIAL_MONTHLY: "esa-financial-monthly"
	});
	/**
	* Opções futuras de distribuição.
	* Declarativas — não implementam envio, PDF, ou download real.
	*/
	var DISTRIBUTION_DEFAULTS = Object.freeze({
		pdfReady: false,
		downloadable: true,
		emailReady: false,
		whatsappReady: false,
		manualDelivery: true
	});
	//#endregion
	//#region ../../../reports/energy-credits/energy-credits-report-service.js
	/**
	* ESA OS — Reports / Energy Credits
	* EnergyCreditsReportService
	*
	* Builders de contratos de relatório mensal de créditos de energia.
	* Fonte única: EnergyCreditsQueryService (dependency injection).
	* Sem Firebase. Sem UI. Sem PDF real. Sem envio. READ-ONLY.
	* Data minimization aplicada — whitelist-first em toda saída.
	*/
	function _sanitize(v) {
		if (v === void 0) return null;
		if (typeof v === "number" && isNaN(v)) return null;
		if (Array.isArray(v)) return v.map(_sanitize);
		if (v !== null && typeof v === "object") {
			const out = {};
			for (const k of Object.keys(v)) out[k] = _sanitize(v[k]);
			return out;
		}
		return v;
	}
	function _payStatus(paid, open) {
		if (paid > 0) return "paid";
		if (open > 0) return "pending";
		return null;
	}
	function _reportMetadata(alerts, available, unavailable) {
		return {
			source: "energy-credits-query-service",
			sourceVersion: "1.0",
			minimized: true,
			readOnly: true,
			sectionsAvailable: available,
			sectionsUnavailable: unavailable,
			alertCount: Array.isArray(alerts) ? alerts.length : 0,
			generatedBy: "esa-os",
			requiresPdfRendering: true
		};
	}
	function _wrap(report, source, filters, options) {
		return new EnergyCreditsQueryResult(report, {
			source,
			filters: Object.assign({}, filters),
			referenceDate: options.referenceDate || null,
			count: 1
		}, options.referenceDate || null);
	}
	var EnergyCreditsReportService = class {
		constructor(queryService) {
			this._qs = queryService || null;
		}
		_requireQueryService(method) {
			if (!this._qs || typeof this._qs.getGeneratingUnit !== "function") throw new TypeError(`[EnergyCreditsReportService.${method}] queryService inválido`);
		}
		buildOwnerMonthlyReport(generatingUnitId, referenceMonth, options = {}) {
			this._requireQueryService("buildOwnerMonthlyReport");
			const qOpts = { referenceDate: options.referenceDate || null };
			const filters = { referenceMonth };
			const genGid = { generatingUnitId };
			const unit = this._qs.getGeneratingUnitSummary(generatingUnitId, filters, qOpts).data.generatingUnit;
			if (!unit) throw new Error(`[buildOwnerMonthlyReport] Unidade geradora não encontrada: ${generatingUnitId}`);
			const stmt = this._qs.getMonthlyStatement(generatingUnitId, referenceMonth, qOpts).data;
			const benUnits = this._qs.searchBeneficiaryUnits(genGid, qOpts).data.sort((a, b) => (a.id || "").localeCompare(b.id || ""));
			const fin = this._qs.getFinancialSummary({
				...filters,
				...genGid
			}, qOpts).data;
			const alertsSum = this._qs.getAlertsSummary({
				...filters,
				...genGid
			}, qOpts).data;
			const genRec = this._qs.getGeneratingUnitMonthlyHistory(generatingUnitId, filters, qOpts).data[0] || null;
			const bItems = this._buildBeneficiaryItems(benUnits, referenceMonth, qOpts);
			const creditDst = this._buildCreditDestinations(benUnits, referenceMonth, qOpts);
			const alerts = alertsSum.alerts;
			return _wrap(_sanitize({
				reportVersion: "1.0",
				reportType: REPORT_TYPE.OWNER_MONTHLY,
				generatedAt: options.referenceDate || null,
				referenceMonth,
				target: this._ownerTarget(unit),
				title: `Relatório Mensal do Proprietário — ${unit.name} — ${referenceMonth}`,
				summary: this._ownerSummary(unit, stmt, genRec, fin, referenceMonth),
				sections: this._ownerSections(unit, stmt, genRec, fin, alerts, bItems, referenceMonth, creditDst),
				totals: this._ownerTotals(stmt, fin),
				alerts,
				distribution: Object.assign({}, DISTRIBUTION_DEFAULTS),
				metadata: _reportMetadata(alerts, [
					"identification",
					"generationAndBalance",
					"beneficiaryConsumption",
					"creditDestinations",
					"ownerSettlement",
					"alerts",
					"documentsPlaceholder"
				], [])
			}), "ec.buildOwnerMonthlyReport", {
				generatingUnitId,
				referenceMonth
			}, options);
		}
		_ownerTarget(unit) {
			return {
				targetType: "generating-unit-owner",
				generatingUnitId: unit.id,
				ownerName: unit.ownerName,
				ownerDocument: unit.ownerDocument
			};
		}
		_ownerSummary(unit, stmt, genRec, fin, referenceMonth) {
			return {
				generatingUnitName: unit.name,
				ownerName: unit.ownerName,
				referenceMonth,
				previousBalanceKwh: stmt ? stmt.previousBalanceKwh : null,
				monthlyGenerationKwh: stmt ? stmt.totalGenerationKwh : null,
				availableKwhBeforeAllocation: stmt ? stmt.availableKwhBeforeAllocation : null,
				totalAllocatedKwh: stmt ? stmt.totalAllocatedKwh : null,
				totalCompensatedKwh: stmt ? stmt.totalCompensatedKwh : null,
				totalPendingKwh: stmt ? stmt.totalPendingKwh : null,
				currentBalanceKwh: stmt ? stmt.currentBalanceKwh : null,
				purchaseKwhPrice: genRec ? genRec.purchaseKwhPrice : null,
				monthlyOwnerReturn: genRec ? genRec.monthlyOwnerReturn : null,
				accumulatedOwnerReturn: genRec ? genRec.accumulatedOwnerReturn : null,
				paymentStatus: _payStatus(fin.paidOwnerSettlements, fin.openOwnerSettlements)
			};
		}
		_ownerSections(unit, stmt, genRec, fin, alerts, bItems, referenceMonth, creditDst) {
			return {
				identification: this._genIdentification(unit),
				generationAndBalance: this._genBalance(stmt, referenceMonth),
				beneficiaryConsumption: {
					count: bItems.length,
					beneficiaries: bItems
				},
				creditDestinations: creditDst,
				ownerSettlement: this._ownerSettlement(genRec, fin),
				alerts: {
					count: alerts.length,
					items: alerts
				},
				documentsPlaceholder: {
					pdfReport: null,
					signed: null,
					attachments: []
				}
			};
		}
		_ownerTotals(stmt, fin) {
			return {
				totalGenerationKwh: stmt ? stmt.totalGenerationKwh : null,
				totalAllocatedKwh: stmt ? stmt.totalAllocatedKwh : null,
				totalCompensatedKwh: stmt ? stmt.totalCompensatedKwh : null,
				totalOwnerReturn: fin.totalOwnerReturn,
				grossSpread: fin.grossSpread
			};
		}
		_genIdentification(unit) {
			return {
				generatingUnitId: unit.id,
				name: unit.name,
				ownerName: unit.ownerName,
				ownerDocument: unit.ownerDocument,
				uc: unit.uc,
				utilityCompany: unit.utilityCompany,
				operationalStatus: unit.operationalStatus,
				installedPower: unit.installedPower,
				address: unit.address,
				city: unit.city,
				state: unit.state
			};
		}
		_genBalance(stmt, referenceMonth) {
			return {
				referenceMonth,
				previousBalanceKwh: stmt ? stmt.previousBalanceKwh : null,
				monthlyGenerationKwh: stmt ? stmt.totalGenerationKwh : null,
				availableKwhBeforeAllocation: stmt ? stmt.availableKwhBeforeAllocation : null,
				totalAllocatedKwh: stmt ? stmt.totalAllocatedKwh : null,
				totalCompensatedKwh: stmt ? stmt.totalCompensatedKwh : null,
				totalPendingKwh: stmt ? stmt.totalPendingKwh : null,
				currentBalanceKwh: stmt ? stmt.currentBalanceKwh : null,
				beneficiaryCount: stmt ? stmt.beneficiaryCount : 0
			};
		}
		_ownerSettlement(genRec, fin) {
			return {
				purchaseKwhPrice: genRec ? genRec.purchaseKwhPrice : null,
				consumedAllocatedKwh: genRec ? genRec.consumedAllocatedKwh : null,
				monthlyOwnerReturn: genRec ? genRec.monthlyOwnerReturn : null,
				accumulatedOwnerReturn: genRec ? genRec.accumulatedOwnerReturn : null,
				totalSettlementAmount: fin.totalOwnerSettlementAmount,
				totalSettlementOpen: fin.totalOwnerSettlementOpenAmount,
				paymentStatus: _payStatus(fin.paidOwnerSettlements, fin.openOwnerSettlements)
			};
		}
		_buildBeneficiaryItems(benUnits, referenceMonth, qOpts) {
			return benUnits.map((u) => {
				const hist = this._qs.getBeneficiaryMonthlyHistory(u.id, { referenceMonth }, qOpts).data;
				const rec = hist.length > 0 ? hist[0] : null;
				return {
					beneficiaryUnitId: u.id,
					name: u.name,
					uc: u.uc,
					subscriptionStatus: u.subscriptionStatus,
					monthlyConsumptionKwh: rec ? rec.monthlyConsumptionKwh : null,
					allocatedKwh: rec ? rec.allocatedKwh : null,
					compensatedKwh: rec ? rec.compensatedKwh : null,
					pendingKwh: rec ? rec.pendingKwh : null,
					esaInvoiceAmount: rec ? rec.esaInvoiceAmount : null,
					paymentStatus: rec ? rec.paymentStatus : null
				};
			});
		}
		_buildCreditDestinations(benUnits, referenceMonth, qOpts) {
			const items = benUnits.map((u) => {
				const hist = this._qs.getBeneficiaryMonthlyHistory(u.id, { referenceMonth }, qOpts).data;
				const rec = hist.length > 0 ? hist[0] : null;
				const bal = this._qs.getBeneficiaryCreditBalance ? this._qs.getBeneficiaryCreditBalance(u.id, referenceMonth, qOpts).data : null;
				return {
					beneficiaryUnitId: u.id,
					beneficiaryName: u.name,
					beneficiaryUc: u.uc,
					utilityCompany: u.utilityCompany,
					allocationPercentage: bal ? bal.allocationPercentage : null,
					creditsReceivedKwh: bal ? bal.creditsReceivedKwh : null,
					monthlyConsumptionKwh: rec ? rec.monthlyConsumptionKwh : null,
					creditsCompensatedKwh: bal ? bal.creditsCompensatedKwh : rec ? rec.compensatedKwh : null,
					previousBalanceKwh: bal ? bal.previousBalanceKwh : null,
					currentBalanceKwh: bal ? bal.currentBalanceKwh : null,
					coverageMonths: bal ? bal.coverageMonths : null
				};
			}).sort((a, b) => (a.beneficiaryUnitId || "").localeCompare(b.beneficiaryUnitId || ""));
			const sum = (field) => roundKwh(items.reduce((s, i) => s + (i[field] || 0), 0));
			return {
				items,
				summary: {
					beneficiaryCount: items.length,
					totalCreditsDistributedKwh: sum("creditsReceivedKwh"),
					totalBeneficiaryConsumptionKwh: sum("monthlyConsumptionKwh"),
					totalCreditsCompensatedKwh: sum("creditsCompensatedKwh"),
					totalBeneficiaryCreditBalanceKwh: sum("currentBalanceKwh")
				}
			};
		}
		buildBeneficiaryMonthlyReport(beneficiaryUnitId, referenceMonth, options = {}) {
			this._requireQueryService("buildBeneficiaryMonthlyReport");
			const qOpts = { referenceDate: options.referenceDate || null };
			const filters = { referenceMonth };
			const unit = this._qs.getBeneficiarySummary(beneficiaryUnitId, filters, qOpts).data.beneficiaryUnit;
			if (!unit) throw new Error(`[buildBeneficiaryMonthlyReport] Unidade beneficiária não encontrada: ${beneficiaryUnitId}`);
			const hist = this._qs.getBeneficiaryMonthlyHistory(beneficiaryUnitId, filters, qOpts).data;
			const rec = hist.length > 0 ? hist[0] : null;
			const aFilters = {
				...filters,
				generatingUnitId: unit.generatingUnitId
			};
			const alerts = this._qs.getAlertsSummary(aFilters, qOpts).data.alerts;
			const billingSnapshot = options.billingSnapshot || null;
			const savingsHistory = options.beneficiarySavingsHistory || null;
			return _wrap(_sanitize({
				reportVersion: "1.0",
				reportType: REPORT_TYPE.BENEFICIARY_MONTHLY,
				generatedAt: options.referenceDate || null,
				referenceMonth,
				target: this._benTarget(unit),
				title: `Relatório Mensal da Unidade Beneficiária — ${unit.name} — ${referenceMonth}`,
				summary: this._benSummary(unit, rec, referenceMonth),
				sections: this._benSections(unit, rec, alerts, referenceMonth, billingSnapshot, savingsHistory),
				totals: this._benTotals(rec),
				alerts,
				billingSnapshot,
				distribution: Object.assign({}, DISTRIBUTION_DEFAULTS),
				metadata: _reportMetadata(alerts, [
					"identification",
					"consumption",
					"creditBalance",
					"billingComparison",
					"savings",
					"savingsHistory",
					"settlement",
					"payment",
					"alerts",
					"documentsPlaceholder"
				], [])
			}), "ec.buildBeneficiaryMonthlyReport", {
				beneficiaryUnitId,
				referenceMonth
			}, options);
		}
		_benTarget(unit) {
			return {
				targetType: "beneficiary-unit",
				beneficiaryUnitId: unit.id,
				generatingUnitId: unit.generatingUnitId,
				name: unit.name,
				document: unit.holderName || null,
				uc: unit.uc
			};
		}
		_benSummary(unit, rec, referenceMonth) {
			return {
				beneficiaryName: unit.name,
				uc: unit.uc,
				referenceMonth,
				monthlyConsumptionKwh: rec ? rec.monthlyConsumptionKwh : null,
				allocatedKwh: rec ? rec.allocatedKwh : null,
				compensatedKwh: rec ? rec.compensatedKwh : null,
				pendingKwh: rec ? rec.pendingKwh : null,
				residualKwh: rec ? rec.residualKwh : null,
				esaKwhPrice: rec ? rec.esaKwhPrice : null,
				utilityReferenceTariff: rec ? rec.utilityReferenceTariff : null,
				billWithoutEsa: rec ? rec.billWithoutEsa : null,
				esaInvoiceAmount: rec ? rec.esaInvoiceAmount : null,
				residualUtilityAmount: rec ? rec.residualUtilityAmount : null,
				billWithEsa: rec ? rec.billWithEsa : null,
				monthlyDiscount: rec ? rec.monthlyDiscount : null,
				accumulatedDiscountTotal: rec ? rec.accumulatedDiscountTotal : null,
				paymentStatus: rec ? rec.paymentStatus : null,
				dueDate: rec ? rec.dueDate : null,
				paidAt: rec ? rec.paidAt : null
			};
		}
		_benSections(unit, rec, alerts, referenceMonth, billingSnapshot = null, savingsHistory = null) {
			const creditBal = this._qs.getBeneficiaryCreditBalance ? this._qs.getBeneficiaryCreditBalance(unit.id, referenceMonth).data : null;
			return {
				identification: this._benIdentification(unit),
				consumption: this._consumptionSection(rec),
				creditBalance: this._creditBalanceSection(creditBal),
				billingComparison: this._billingComparisonSection(rec, billingSnapshot),
				savings: this._savingsSection(rec, billingSnapshot),
				savingsHistory: this._savingsHistorySection(savingsHistory, rec),
				settlement: this._settlementSection(billingSnapshot),
				payment: this._paymentSection(rec),
				alerts: {
					count: alerts.length,
					items: alerts
				},
				documentsPlaceholder: {
					pdfReport: null,
					signed: null,
					attachments: []
				}
			};
		}
		_benTotals(rec) {
			if (!rec) return null;
			return {
				compensatedKwh: rec.compensatedKwh,
				esaInvoiceAmount: rec.esaInvoiceAmount,
				monthlyDiscount: rec.monthlyDiscount,
				accumulatedDiscountTotal: rec.accumulatedDiscountTotal
			};
		}
		_benIdentification(unit) {
			return {
				beneficiaryUnitId: unit.id,
				generatingUnitId: unit.generatingUnitId,
				name: unit.name,
				holderName: unit.holderName,
				uc: unit.uc,
				utilityCompany: unit.utilityCompany,
				subscriptionStatus: unit.subscriptionStatus,
				address: unit.address,
				city: unit.city,
				state: unit.state
			};
		}
		_consumptionSection(rec) {
			return {
				monthlyConsumptionKwh: rec ? rec.monthlyConsumptionKwh : null,
				allocatedKwh: rec ? rec.allocatedKwh : null,
				compensatedKwh: rec ? rec.compensatedKwh : null,
				pendingKwh: rec ? rec.pendingKwh : null,
				residualKwh: rec ? rec.residualKwh : null
			};
		}
		_creditBalanceSection(bal) {
			if (!bal) return { source: "unavailable" };
			return {
				source: "beneficiary-credit-balance-record",
				previousBalanceKwh: bal.previousBalanceKwh,
				creditsReceivedKwh: bal.creditsReceivedKwh,
				creditsCompensatedKwh: bal.creditsCompensatedKwh,
				positiveAdjustmentsKwh: bal.positiveAdjustmentsKwh,
				negativeAdjustmentsKwh: bal.negativeAdjustmentsKwh,
				currentBalanceKwh: bal.currentBalanceKwh,
				averageMonthlyConsumptionKwh: bal.averageMonthlyConsumptionKwh,
				preventiveMarginPercentage: bal.preventiveMarginPercentage,
				targetCreditKwh: bal.targetCreditKwh,
				allocationPercentage: bal.allocationPercentage,
				coverageMonths: bal.coverageMonths
			};
		}
		_savingsHistorySection(savingsHistory, rec) {
			if (!Array.isArray(savingsHistory) || savingsHistory.length === 0) return {
				source: "unavailable",
				currentMonthSavings: rec ? rec.monthlyDiscount : null
			};
			const sorted = [...savingsHistory].sort((a, b) => (a.referenceMonth || "").localeCompare(b.referenceMonth || ""));
			const first = sorted[0];
			const last = sorted[sorted.length - 1];
			const accumulated = sorted.reduce((s, snap) => s + (snap.monthlySavings ?? snap.economiaMensal ?? 0), 0);
			return {
				source: "savings-history",
				currentMonthSavings: last.monthlySavings ?? last.economiaMensal ?? null,
				accumulatedSavings: roundMoney(accumulated),
				customerSinceReferenceMonth: first.referenceMonth || null,
				monthsAsCustomer: sorted.length
			};
		}
		_settlementSection(billingSnapshot) {
			const r = billingSnapshot && billingSnapshot.settlementRecipient;
			if (!r) return { source: "unavailable" };
			return {
				source: "billing-snapshot",
				recipientName: r.recipientName || null,
				recipientDocument: r.recipientDocument || null,
				pixKey: r.pixKey || null,
				pixKeyType: r.pixKeyType || null
			};
		}
		_billingComparisonSection(rec, billingSnapshot = null) {
			if (billingSnapshot) return {
				source: "billing-snapshot",
				calculationSource: billingSnapshot.calculationSource,
				billWithoutEsa: billingSnapshot.contaConcessionaria?.total ?? null,
				billWithEsa: billingSnapshot.contaEsa?.total ?? null,
				esaKwhPrice: billingSnapshot.inputs?.preco_kwh ?? null,
				utilityReferenceTariff: billingSnapshot.inputs?.te_com ?? null,
				esaInvoiceAmount: billingSnapshot.contaEsa?.total ?? null,
				residualUtilityAmount: billingSnapshot.contaEsa?.fioB ?? null,
				componentesTarifarios: billingSnapshot.componentesTarifarios || null
			};
			if (!rec) return { source: "unavailable" };
			return {
				source: "operational-record",
				esaKwhPrice: rec.esaKwhPrice || null,
				utilityReferenceTariff: rec.utilityReferenceTariff || null,
				billWithoutEsa: rec.billWithoutEsa || null,
				esaInvoiceAmount: rec.esaInvoiceAmount || null,
				residualUtilityAmount: rec.residualUtilityAmount || null,
				billWithEsa: rec.billWithEsa || null
			};
		}
		_savingsSection(rec, billingSnapshot = null) {
			if (billingSnapshot) return {
				source: "billing-snapshot",
				monthlySavings: billingSnapshot.economiaMensal ?? null,
				savingsPercentage: billingSnapshot.economiaPercentual ?? null,
				annualSavings: billingSnapshot.economiaAnual ?? null,
				monthlyDiscount: rec ? rec.monthlyDiscount : null,
				previousAccumulatedDiscount: rec ? rec.previousAccumulatedDiscount : null,
				accumulatedDiscountTotal: rec ? rec.accumulatedDiscountTotal : null
			};
			return {
				source: "operational-record",
				monthlyDiscount: rec ? rec.monthlyDiscount : null,
				previousAccumulatedDiscount: rec ? rec.previousAccumulatedDiscount : null,
				accumulatedDiscountTotal: rec ? rec.accumulatedDiscountTotal : null
			};
		}
		_paymentSection(rec) {
			return {
				esaInvoiceAmount: rec ? rec.esaInvoiceAmount : null,
				paymentStatus: rec ? rec.paymentStatus : null,
				dueDate: rec ? rec.dueDate : null,
				paidAt: rec ? rec.paidAt : null
			};
		}
		buildEsaInternalMonthlyReport(referenceMonth, options = {}) {
			this._requireQueryService("buildEsaInternalMonthlyReport");
			const qOpts = { referenceDate: options.referenceDate || null };
			const filters = { referenceMonth };
			const exec = this._qs.getExecutiveSummary(filters, qOpts).data;
			const fin = this._qs.getFinancialSummary(filters, qOpts).data;
			const alerts = this._qs.getAlertsSummary(filters, qOpts).data.alerts;
			return _wrap(_sanitize({
				reportVersion: "1.0",
				reportType: REPORT_TYPE.ESA_INTERNAL_MONTHLY,
				generatedAt: options.referenceDate || null,
				referenceMonth,
				target: {
					targetType: "esa-internal",
					organization: "esa"
				},
				title: `Relatório Interno Mensal ESA — ${referenceMonth}`,
				summary: this._internalSummary(exec, fin, referenceMonth),
				sections: this._internalSections(exec, fin, alerts),
				totals: this._internalTotals(exec, fin),
				alerts,
				distribution: Object.assign({}, DISTRIBUTION_DEFAULTS),
				metadata: _reportMetadata(alerts, [
					"executiveSummary",
					"operationalSummary",
					"financialSummary",
					"alerts",
					"pendingActionsPlaceholder"
				], [])
			}), "ec.buildEsaInternalMonthlyReport", { referenceMonth }, options);
		}
		_internalSummary(exec, fin, referenceMonth) {
			return {
				referenceMonth,
				generatingUnitCount: exec.generatingUnitCount,
				beneficiaryUnitCount: exec.beneficiaryUnitCount,
				totalGenerationKwh: exec.totalGenerationKwh,
				totalAllocatedKwh: exec.totalAllocatedKwh,
				totalCompensatedKwh: exec.totalCompensatedKwh,
				totalPendingKwh: exec.totalPendingKwh,
				totalCurrentBalanceKwh: exec.totalCurrentBalanceKwh,
				totalEsaRevenue: exec.totalEsaRevenue,
				totalOwnerReturn: exec.totalOwnerReturn,
				grossSpread: exec.grossSpread,
				totalMonthlyDiscount: exec.totalMonthlyDiscount,
				delinquentInvoiceCount: exec.delinquentInvoiceCount,
				alertCount: exec.alertCount
			};
		}
		_internalSections(exec, fin, alerts) {
			return {
				executiveSummary: {
					generatingUnitCount: exec.generatingUnitCount,
					beneficiaryUnitCount: exec.beneficiaryUnitCount,
					referenceMonths: exec.referenceMonths,
					alertCount: exec.alertCount,
					criticalAlertCount: exec.criticalAlertCount
				},
				operationalSummary: {
					totalGenerationKwh: exec.totalGenerationKwh,
					totalAllocatedKwh: exec.totalAllocatedKwh,
					totalCompensatedKwh: exec.totalCompensatedKwh,
					totalPendingKwh: exec.totalPendingKwh,
					totalCurrentBalanceKwh: exec.totalCurrentBalanceKwh
				},
				financialSummary: {
					totalEsaRevenue: fin.totalEsaRevenue,
					totalOwnerReturn: fin.totalOwnerReturn,
					grossSpread: fin.grossSpread,
					totalInvoicedAmount: fin.totalInvoicedAmount,
					overdueInvoices: fin.overdueInvoices
				},
				alerts: {
					count: alerts.length,
					items: alerts
				},
				pendingActionsPlaceholder: {
					items: [],
					generatedAt: null
				}
			};
		}
		_internalTotals(exec, fin) {
			return {
				totalGenerationKwh: exec.totalGenerationKwh,
				totalEsaRevenue: exec.totalEsaRevenue,
				totalOwnerReturn: exec.totalOwnerReturn,
				grossSpread: exec.grossSpread,
				totalInvoicedAmount: fin.totalInvoicedAmount
			};
		}
		buildEsaFinancialMonthlyReport(referenceMonth, options = {}) {
			this._requireQueryService("buildEsaFinancialMonthlyReport");
			const qOpts = { referenceDate: options.referenceDate || null };
			const filters = { referenceMonth };
			const fin = this._qs.getFinancialSummary(filters, qOpts).data;
			const exec = this._qs.getExecutiveSummary(filters, qOpts).data;
			const alerts = this._qs.getAlertsSummary(filters, qOpts).data.alerts;
			return _wrap(_sanitize({
				reportVersion: "1.0",
				reportType: REPORT_TYPE.ESA_FINANCIAL_MONTHLY,
				generatedAt: options.referenceDate || null,
				referenceMonth,
				target: {
					targetType: "esa-financial",
					organization: "esa"
				},
				title: `Relatório Financeiro Mensal ESA — ${referenceMonth}`,
				summary: this._financialSummary(fin, referenceMonth),
				sections: this._financialSections(fin, exec, alerts),
				totals: this._financialTotals(fin),
				alerts,
				distribution: Object.assign({}, DISTRIBUTION_DEFAULTS),
				metadata: _reportMetadata(alerts, [
					"invoicing",
					"receipts",
					"ownerSettlements",
					"spread",
					"delinquency",
					"alerts"
				], [])
			}), "ec.buildEsaFinancialMonthlyReport", { referenceMonth }, options);
		}
		_financialSummary(fin, referenceMonth) {
			return {
				referenceMonth,
				totalEsaRevenue: fin.totalEsaRevenue,
				totalOwnerReturn: fin.totalOwnerReturn,
				grossSpread: fin.grossSpread,
				totalInvoices: fin.totalInvoices,
				paidInvoices: fin.paidInvoices,
				openInvoices: fin.openInvoices,
				overdueInvoices: fin.overdueInvoices,
				totalInvoicedAmount: fin.totalInvoicedAmount,
				totalPaidAmount: fin.totalPaidAmount,
				totalOpenAmount: fin.totalOpenAmount,
				totalOwnerSettlements: fin.totalOwnerSettlements,
				paidOwnerSettlements: fin.paidOwnerSettlements,
				openOwnerSettlements: fin.openOwnerSettlements,
				totalOwnerSettlementAmount: fin.totalOwnerSettlementAmount,
				totalOwnerSettlementOpenAmount: fin.totalOwnerSettlementOpenAmount
			};
		}
		_financialSections(fin, exec, alerts) {
			return {
				invoicing: {
					totalInvoices: fin.totalInvoices,
					totalInvoicedAmount: fin.totalInvoicedAmount,
					paidInvoices: fin.paidInvoices,
					openInvoices: fin.openInvoices,
					overdueInvoices: fin.overdueInvoices
				},
				receipts: {
					totalPaidAmount: fin.totalPaidAmount,
					totalOpenAmount: fin.totalOpenAmount,
					paidInvoices: fin.paidInvoices
				},
				ownerSettlements: {
					totalOwnerSettlements: fin.totalOwnerSettlements,
					paidOwnerSettlements: fin.paidOwnerSettlements,
					openOwnerSettlements: fin.openOwnerSettlements,
					totalOwnerSettlementAmount: fin.totalOwnerSettlementAmount,
					totalOwnerSettlementOpenAmount: fin.totalOwnerSettlementOpenAmount
				},
				spread: {
					totalEsaRevenue: fin.totalEsaRevenue,
					totalOwnerReturn: fin.totalOwnerReturn,
					grossSpread: fin.grossSpread
				},
				delinquency: {
					overdueInvoices: fin.overdueInvoices,
					totalOpenAmount: fin.totalOpenAmount,
					delinquentInvoiceCount: exec.delinquentInvoiceCount
				},
				alerts: {
					count: alerts.length,
					items: alerts
				}
			};
		}
		_financialTotals(fin) {
			return {
				totalEsaRevenue: fin.totalEsaRevenue,
				totalOwnerReturn: fin.totalOwnerReturn,
				grossSpread: fin.grossSpread,
				totalInvoicedAmount: fin.totalInvoicedAmount,
				totalOwnerSettlementAmount: fin.totalOwnerSettlementAmount,
				totalOwnerSettlementOpenAmount: fin.totalOwnerSettlementOpenAmount
			};
		}
	};
	//#endregion
	//#region ../../../reports/energy-credits/index.js
	var energyCreditsReportService = new EnergyCreditsReportService(energyCreditsQueryService);
	//#endregion
	//#region ../../../repositories/energy-credits/energy-credits-paths.js
	/**
	* ESA OS — Repositories / Energy Credits
	* Constantes de paths lógicos e builder de path.
	*
	* Paths são lógicos — não acoplados ao Firebase diretamente.
	* Validação defensiva: path traversal e caracteres inválidos são rejeitados.
	*/
	/** Coleções permitidas no módulo Energy Credits. */
	var EC_COLLECTIONS = Object.freeze([
		"generatingUnits",
		"beneficiaryUnits",
		"generatingUnitMonthlyRecords",
		"beneficiaryMonthlyRecords",
		"creditAllocations",
		"ownerSettlements",
		"esaInvoices",
		"monthlyReports",
		"creditDocuments",
		"creditAuditLog",
		"beneficiaryCreditBalanceRecords",
		"utilityBillImports"
	]);
	var _ALLOWED = new Set(EC_COLLECTIONS);
	/** Prefixo raiz de todos os paths do módulo. */
	var EC_ROOT = "energyCredits";
	Object.freeze(Object.fromEntries(EC_COLLECTIONS.map((c) => [c, `${EC_ROOT}/${c}`])));
	/** Caracteres proibidos em IDs (Firebase + path traversal). */
	var INVALID_ID_PATTERNS = [
		"/",
		"..",
		"#",
		"$",
		"[",
		"]"
	];
	/**
	* Constrói o path lógico de uma coleção (sem id).
	* Útil para listagens que precisam do path da collection inteira.
	*
	* @param {string} collection - Nome da coleção (deve estar em EC_COLLECTIONS)
	* @returns {string}          - "energyCredits/{collection}"
	* @throws {TypeError}        - Se collection for inválida
	*/
	function buildEnergyCreditsCollectionPath(collection) {
		if (!_ALLOWED.has(collection)) throw new TypeError(`[buildEnergyCreditsCollectionPath] collection inválida: "${collection}". Válidas: ${EC_COLLECTIONS.join(", ")}`);
		return `${EC_ROOT}/${collection}`;
	}
	/**
	* Constrói o path lógico de um item em uma coleção.
	*
	* @param {string} collection - Nome da coleção (deve estar em EC_COLLECTIONS)
	* @param {string} id         - ID do item (obrigatório, sem caracteres inválidos)
	* @returns {string}          - "energyCredits/{collection}/{id}"
	* @throws {TypeError}        - Se collection ou id forem inválidos
	*/
	function buildEnergyCreditsPath(collection, id) {
		if (!_ALLOWED.has(collection)) throw new TypeError(`[buildEnergyCreditsPath] collection inválida: "${collection}". Válidas: ${EC_COLLECTIONS.join(", ")}`);
		if (!id || typeof id !== "string" || !id.trim()) throw new TypeError("[buildEnergyCreditsPath] id é obrigatório e deve ser string não-vazia");
		for (const pattern of INVALID_ID_PATTERNS) if (id.includes(pattern)) throw new TypeError(`[buildEnergyCreditsPath] id contém caractere inválido: "${pattern}" em "${id}"`);
		return `${EC_ROOT}/${collection}/${id}`;
	}
	//#endregion
	//#region ../../../repositories/energy-credits/energy-credits-repository-result.js
	/**
	* ESA OS — Repositories / Energy Credits
	* Contrato de resultado para operações de repositório.
	*
	* Nunca lança exceção para erros de negócio — erros de domínio são valores.
	* Somente erros de programação (null passado onde objeto é esperado) devem
	* propagar como exception nos métodos estáticos de construção.
	*
	* Contrato: { ok, data, errors, warnings, metadata }
	*/
	var EnergyCreditsRepositoryResult = class {
		/**
		* Cria resultado de sucesso.
		*
		* @param {*}        data
		* @param {Array}    warnings
		* @param {object}   metadata
		*/
		static ok(data, warnings = [], metadata = {}) {
			return Object.freeze({
				ok: true,
				data,
				errors: [],
				warnings: Array.isArray(warnings) ? warnings : [],
				metadata: metadata && typeof metadata === "object" ? metadata : {}
			});
		}
		/**
		* Cria resultado de falha.
		*
		* @param {Array}    errors
		* @param {Array}    warnings
		* @param {object}   metadata
		*/
		static fail(errors = [], warnings = [], metadata = {}) {
			return Object.freeze({
				ok: false,
				data: null,
				errors: Array.isArray(errors) ? errors : [errors].filter(Boolean),
				warnings: Array.isArray(warnings) ? warnings : [],
				metadata: metadata && typeof metadata === "object" ? metadata : {}
			});
		}
		/**
		* Cria estrutura de erro individual.
		*
		* @param {string}      code     - Código de erro (ex: 'REQUIRED', 'NOT_FOUND')
		* @param {string}      message  - Mensagem legível por humanos
		* @param {string|null} field    - Campo que gerou o erro (opcional)
		*/
		static makeError(code, message, field = null) {
			return Object.freeze({
				code,
				message,
				field: field !== void 0 ? field : null
			});
		}
	};
	//#endregion
	//#region ../../../repositories/energy-credits/energy-credits-memory-repository.js
	/**
	* ESA OS — Repositories / Energy Credits
	* Implementação em memória do repositório de créditos.
	*
	* Usado em testes, read-model hydration e contextos sem Firebase.
	* Todos os gets/lists retornam cópias defensivas — nunca referências internas.
	* Normalização: undefined→null, NaN→null, Date→ISO, [object Object]→null.
	* Segurança: campos sensíveis são removidos em todas as escritas.
	*/
	var FORBIDDEN_KEYS$4 = /* @__PURE__ */ new Set([
		"password",
		"passHash",
		"sessionToken",
		"sessionExpiresAt",
		"serviceAccount",
		"firebaseConfig",
		"apiKey",
		"secret",
		"downloadUrl"
	]);
	function _normSecure$1(v, allowFileUrl = false) {
		if (v === void 0) return null;
		if (typeof v === "number" && isNaN(v)) return null;
		if (v instanceof Date) return v.toISOString();
		if (typeof v === "string" && v === "[object Object]") return null;
		if (Array.isArray(v)) return v.map((item) => _normSecure$1(item, allowFileUrl));
		if (v !== null && typeof v === "object") {
			const out = {};
			for (const [k, val] of Object.entries(v)) {
				if (FORBIDDEN_KEYS$4.has(k)) continue;
				if (k === "fileUrl" && !allowFileUrl) continue;
				out[k] = _normSecure$1(val, allowFileUrl);
			}
			return out;
		}
		return v;
	}
	function _applyFilters$3(items, filters) {
		let result = items;
		if (filters.id != null) result = result.filter((i) => i.id === filters.id);
		if (filters.referenceMonth != null) result = result.filter((i) => i.referenceMonth === filters.referenceMonth);
		if (filters.referenceMonthFrom != null) result = result.filter((i) => i.referenceMonth >= filters.referenceMonthFrom);
		if (filters.referenceMonthTo != null) result = result.filter((i) => i.referenceMonth <= filters.referenceMonthTo);
		if (filters.generatingUnitId != null) result = result.filter((i) => i.generatingUnitId === filters.generatingUnitId);
		if (filters.beneficiaryUnitId != null) result = result.filter((i) => i.beneficiaryUnitId === filters.beneficiaryUnitId);
		if (filters.targetType != null) result = result.filter((i) => i.targetType === filters.targetType);
		if (filters.targetId != null) result = result.filter((i) => i.targetId === filters.targetId);
		if (filters.paymentStatus != null) result = result.filter((i) => i.paymentStatus === filters.paymentStatus);
		if (filters.status != null) result = result.filter((i) => i.status === filters.status);
		if (filters.utilityCompany != null) result = result.filter((i) => i.utilityCompany === filters.utilityCompany);
		if (filters.ownerName != null) result = result.filter((i) => i.ownerName === filters.ownerName);
		if (filters.document != null) result = result.filter((i) => i.document === filters.document || i.ownerDocument === filters.document);
		if (filters.action != null) result = result.filter((i) => i.action === filters.action);
		if (filters.userId != null) result = result.filter((i) => i.userId === filters.userId);
		return result;
	}
	var EnergyCreditsMemoryRepository = class {
		constructor() {
			this._generatingUnits = /* @__PURE__ */ new Map();
			this._beneficiaryUnits = /* @__PURE__ */ new Map();
			this._generatingUnitMonthlyRecords = /* @__PURE__ */ new Map();
			this._beneficiaryMonthlyRecords = /* @__PURE__ */ new Map();
			this._creditAllocations = /* @__PURE__ */ new Map();
			this._ownerSettlements = /* @__PURE__ */ new Map();
			this._esaInvoices = /* @__PURE__ */ new Map();
			this._monthlyReports = /* @__PURE__ */ new Map();
			this._creditDocuments = /* @__PURE__ */ new Map();
			this._creditAuditLog = /* @__PURE__ */ new Map();
			this._beneficiaryCreditBalanceRecords = /* @__PURE__ */ new Map();
			this._utilityBillImports = /* @__PURE__ */ new Map();
			this._hydrateCount = 0;
			this._lastHydration = null;
		}
		_failRequired(field) {
			return EnergyCreditsRepositoryResult.fail([EnergyCreditsRepositoryResult.makeError("REQUIRED", `${field} é obrigatório`, field)]);
		}
		_save(map, entity, allowFileUrl = false) {
			if (!entity || typeof entity !== "object" || Array.isArray(entity)) return this._failRequired("entity");
			if (!entity.id || typeof entity.id !== "string" || !entity.id.trim()) return this._failRequired("id");
			const norm = _normSecure$1(entity, allowFileUrl);
			map.set(norm.id, norm);
			return EnergyCreditsRepositoryResult.ok(Object.assign({}, norm));
		}
		_get(map, id) {
			if (!id || typeof id !== "string") return this._failRequired("id");
			const item = map.get(id);
			return EnergyCreditsRepositoryResult.ok(item ? Object.assign({}, item) : null);
		}
		_list(map, filters = {}) {
			const filtered = _applyFilters$3(Array.from(map.values()).map((v) => Object.assign({}, v)), filters).sort((a, b) => (a.id || "").localeCompare(b.id || ""));
			return EnergyCreditsRepositoryResult.ok(filtered, [], { count: filtered.length });
		}
		_auditLogId(entry) {
			if (entry.id && typeof entry.id === "string" && entry.id.trim()) return entry.id.trim();
			const { referenceDate, action, targetId } = entry;
			if (referenceDate && action && targetId) return `${referenceDate}::${action}::${targetId}`;
			return null;
		}
		saveGeneratingUnit(unit) {
			return this._save(this._generatingUnits, unit);
		}
		getGeneratingUnit(id) {
			return this._get(this._generatingUnits, id);
		}
		listGeneratingUnits(filters = {}) {
			return this._list(this._generatingUnits, filters);
		}
		saveBeneficiaryUnit(unit) {
			return this._save(this._beneficiaryUnits, unit);
		}
		getBeneficiaryUnit(id) {
			return this._get(this._beneficiaryUnits, id);
		}
		listBeneficiaryUnits(filters = {}) {
			return this._list(this._beneficiaryUnits, filters);
		}
		saveGeneratingUnitMonthlyRecord(record) {
			return this._save(this._generatingUnitMonthlyRecords, record);
		}
		getGeneratingUnitMonthlyRecord(id) {
			return this._get(this._generatingUnitMonthlyRecords, id);
		}
		listGeneratingUnitMonthlyRecords(filters = {}) {
			return this._list(this._generatingUnitMonthlyRecords, filters);
		}
		saveBeneficiaryMonthlyRecord(record) {
			return this._save(this._beneficiaryMonthlyRecords, record);
		}
		getBeneficiaryMonthlyRecord(id) {
			return this._get(this._beneficiaryMonthlyRecords, id);
		}
		listBeneficiaryMonthlyRecords(filters = {}) {
			return this._list(this._beneficiaryMonthlyRecords, filters);
		}
		saveCreditAllocation(alloc) {
			return this._save(this._creditAllocations, alloc);
		}
		getCreditAllocation(id) {
			return this._get(this._creditAllocations, id);
		}
		listCreditAllocations(filters = {}) {
			return this._list(this._creditAllocations, filters);
		}
		saveOwnerSettlement(settlement) {
			return this._save(this._ownerSettlements, settlement);
		}
		getOwnerSettlement(id) {
			return this._get(this._ownerSettlements, id);
		}
		listOwnerSettlements(filters = {}) {
			return this._list(this._ownerSettlements, filters);
		}
		saveEsaInvoice(invoice) {
			return this._save(this._esaInvoices, invoice);
		}
		getEsaInvoice(id) {
			return this._get(this._esaInvoices, id);
		}
		listEsaInvoices(filters = {}) {
			return this._list(this._esaInvoices, filters);
		}
		saveMonthlyReport(report) {
			return this._save(this._monthlyReports, report);
		}
		getMonthlyReport(id) {
			return this._get(this._monthlyReports, id);
		}
		listMonthlyReports(filters = {}) {
			return this._list(this._monthlyReports, filters);
		}
		saveCreditDocument(doc) {
			return this._save(this._creditDocuments, doc, true);
		}
		getCreditDocument(id) {
			return this._get(this._creditDocuments, id);
		}
		listCreditDocuments(filters = {}) {
			return this._list(this._creditDocuments, filters);
		}
		saveBeneficiaryCreditBalanceRecord(record) {
			return this._save(this._beneficiaryCreditBalanceRecords, record);
		}
		getBeneficiaryCreditBalanceRecord(id) {
			return this._get(this._beneficiaryCreditBalanceRecords, id);
		}
		listBeneficiaryCreditBalanceRecords(filters = {}) {
			return this._list(this._beneficiaryCreditBalanceRecords, filters);
		}
		appendCreditAuditLog(entry) {
			if (!entry || typeof entry !== "object" || Array.isArray(entry)) return this._failRequired("entry");
			const id = this._auditLogId(entry);
			if (!id) return EnergyCreditsRepositoryResult.fail([EnergyCreditsRepositoryResult.makeError("REQUIRED", "id ou (referenceDate + action + targetId) são obrigatórios para audit log")]);
			const norm = _normSecure$1({
				...entry,
				id
			}, false);
			this._creditAuditLog.set(id, norm);
			return EnergyCreditsRepositoryResult.ok(Object.assign({}, norm));
		}
		listCreditAuditLog(filters = {}) {
			return this._list(this._creditAuditLog, filters);
		}
		saveUtilityBillImport(record) {
			return this._save(this._utilityBillImports, record);
		}
		getUtilityBillImport(id) {
			return this._get(this._utilityBillImports, id);
		}
		listUtilityBillImports(filters = {}) {
			return this._list(this._utilityBillImports, filters);
		}
		getSnapshot(options = {}) {
			const toArr = (map) => Array.from(map.values()).map((v) => Object.assign({}, v));
			return EnergyCreditsRepositoryResult.ok({
				generatingUnits: toArr(this._generatingUnits),
				beneficiaryUnits: toArr(this._beneficiaryUnits),
				generatingUnitMonthlyRecords: toArr(this._generatingUnitMonthlyRecords),
				beneficiaryMonthlyRecords: toArr(this._beneficiaryMonthlyRecords),
				creditAllocations: toArr(this._creditAllocations),
				ownerSettlements: toArr(this._ownerSettlements),
				esaInvoices: toArr(this._esaInvoices),
				monthlyReports: toArr(this._monthlyReports),
				creditDocuments: toArr(this._creditDocuments),
				creditAuditLog: toArr(this._creditAuditLog),
				beneficiaryCreditBalanceRecords: toArr(this._beneficiaryCreditBalanceRecords),
				utilityBillImports: toArr(this._utilityBillImports)
			});
		}
		hydrateFromSnapshot(snapshot = {}, options = {}) {
			const { replace = true, referenceDate } = options;
			if (replace) this.clear();
			let received = 0;
			let hydrated = 0;
			let skipped = 0;
			const run = (raw, fn) => {
				const items = Array.isArray(raw) ? raw : raw && typeof raw === "object" ? Object.values(raw) : [];
				for (const item of items) {
					received++;
					if (fn(item).ok) hydrated++;
					else skipped++;
				}
			};
			run(snapshot.generatingUnits, this.saveGeneratingUnit.bind(this));
			run(snapshot.beneficiaryUnits, this.saveBeneficiaryUnit.bind(this));
			run(snapshot.generatingUnitMonthlyRecords, this.saveGeneratingUnitMonthlyRecord.bind(this));
			run(snapshot.beneficiaryMonthlyRecords, this.saveBeneficiaryMonthlyRecord.bind(this));
			run(snapshot.creditAllocations, this.saveCreditAllocation.bind(this));
			run(snapshot.ownerSettlements, this.saveOwnerSettlement.bind(this));
			run(snapshot.esaInvoices, this.saveEsaInvoice.bind(this));
			run(snapshot.monthlyReports, this.saveMonthlyReport.bind(this));
			run(snapshot.creditDocuments, this.saveCreditDocument.bind(this));
			run(snapshot.creditAuditLog, this.appendCreditAuditLog.bind(this));
			run(snapshot.beneficiaryCreditBalanceRecords, this.saveBeneficiaryCreditBalanceRecord.bind(this));
			run(snapshot.utilityBillImports, this.saveUtilityBillImport.bind(this));
			this._hydrateCount++;
			const result = {
				received,
				hydrated,
				skipped,
				replaced: replace,
				referenceDate: referenceDate || null
			};
			this._lastHydration = result;
			return EnergyCreditsRepositoryResult.ok(result);
		}
		clear() {
			this._generatingUnits.clear();
			this._beneficiaryUnits.clear();
			this._generatingUnitMonthlyRecords.clear();
			this._beneficiaryMonthlyRecords.clear();
			this._creditAllocations.clear();
			this._ownerSettlements.clear();
			this._esaInvoices.clear();
			this._monthlyReports.clear();
			this._creditDocuments.clear();
			this._creditAuditLog.clear();
			this._beneficiaryCreditBalanceRecords.clear();
			this._utilityBillImports.clear();
			this._hydrateCount = 0;
			this._lastHydration = null;
		}
		getStats() {
			return {
				type: "memory",
				generatingUnitCount: this._generatingUnits.size,
				beneficiaryUnitCount: this._beneficiaryUnits.size,
				generatingUnitMonthlyRecordCount: this._generatingUnitMonthlyRecords.size,
				beneficiaryMonthlyRecordCount: this._beneficiaryMonthlyRecords.size,
				creditAllocationCount: this._creditAllocations.size,
				ownerSettlementCount: this._ownerSettlements.size,
				esaInvoiceCount: this._esaInvoices.size,
				monthlyReportCount: this._monthlyReports.size,
				creditDocumentCount: this._creditDocuments.size,
				creditAuditLogCount: this._creditAuditLog.size,
				beneficiaryCreditBalanceRecordCount: this._beneficiaryCreditBalanceRecords.size,
				utilityBillImportCount: this._utilityBillImports.size,
				hydrateCount: this._hydrateCount,
				lastHydration: this._lastHydration ? Object.assign({}, this._lastHydration) : null
			};
		}
	};
	//#endregion
	//#region ../../../repositories/energy-credits/energy-credits-firebase-repository.js
	/**
	* ESA OS — Repositories / Energy Credits
	* Firebase Adapter — implementação real com firebaseClient injetado.
	*
	* NÃO usa Firebase SDK diretamente.
	* NÃO importa firebase/app, firebase-admin, etc.
	* NÃO acessa window, localStorage, globals.
	* NÃO usa Date.now(), Math.random(), crypto.randomUUID().
	*
	* Requer firebaseClient injetado com interface:
	*   { get(path): Promise<data|null>, set(path, value): Promise<void>, remove?(path): Promise<void> }
	*
	* Todas as operações de dados são async.
	* Erros do client → EnergyCreditsRepositoryResult.fail() — nunca relançados.
	*/
	var SOURCE = "energy-credits-firebase-repository";
	var FORBIDDEN_KEYS$3 = /* @__PURE__ */ new Set([
		"password",
		"passHash",
		"sessionToken",
		"sessionExpiresAt",
		"serviceAccount",
		"firebaseConfig",
		"apiKey",
		"secret",
		"downloadUrl",
		"stack",
		"stackTrace",
		"internalLog"
	]);
	function _normSecure(v, allowFileUrl = false) {
		if (v === void 0) return null;
		if (typeof v === "number" && isNaN(v)) return null;
		if (v instanceof Date) return v.toISOString();
		if (typeof v === "string" && v === "[object Object]") return null;
		if (Array.isArray(v)) return v.map((item) => _normSecure(item, allowFileUrl));
		if (v !== null && typeof v === "object") {
			const out = {};
			for (const [k, val] of Object.entries(v)) {
				if (FORBIDDEN_KEYS$3.has(k)) continue;
				if (k === "fileUrl" && !allowFileUrl) continue;
				out[k] = _normSecure(val, allowFileUrl);
			}
			return out;
		}
		return v;
	}
	function _applyFilters$2(items, filters) {
		let result = items;
		if (filters.id != null) result = result.filter((i) => i.id === filters.id);
		if (filters.referenceMonth != null) result = result.filter((i) => i.referenceMonth === filters.referenceMonth);
		if (filters.referenceMonthFrom != null) result = result.filter((i) => i.referenceMonth >= filters.referenceMonthFrom);
		if (filters.referenceMonthTo != null) result = result.filter((i) => i.referenceMonth <= filters.referenceMonthTo);
		if (filters.generatingUnitId != null) result = result.filter((i) => i.generatingUnitId === filters.generatingUnitId);
		if (filters.beneficiaryUnitId != null) result = result.filter((i) => i.beneficiaryUnitId === filters.beneficiaryUnitId);
		if (filters.targetType != null) result = result.filter((i) => i.targetType === filters.targetType);
		if (filters.targetId != null) result = result.filter((i) => i.targetId === filters.targetId);
		if (filters.paymentStatus != null) result = result.filter((i) => i.paymentStatus === filters.paymentStatus);
		if (filters.status != null) result = result.filter((i) => i.status === filters.status);
		if (filters.utilityCompany != null) result = result.filter((i) => i.utilityCompany === filters.utilityCompany);
		if (filters.ownerName != null) result = result.filter((i) => i.ownerName === filters.ownerName);
		if (filters.document != null) result = result.filter((i) => i.document === filters.document || i.ownerDocument === filters.document);
		if (filters.action != null) result = result.filter((i) => i.action === filters.action);
		if (filters.userId != null) result = result.filter((i) => i.userId === filters.userId);
		return result;
	}
	function _rawToArray(raw, allowFileUrl = false) {
		if (raw == null) return [];
		let pairs;
		if (Array.isArray(raw)) pairs = raw.filter((v) => v != null && typeof v === "object").map((v) => ({
			key: null,
			val: v
		}));
		else if (typeof raw === "object") pairs = Object.entries(raw).filter(([, v]) => v != null).map(([k, v]) => ({
			key: k,
			val: v
		}));
		else return [];
		return pairs.map(({ key, val }) => {
			const norm = _normSecure(val, allowFileUrl);
			if (!norm || typeof norm !== "object") return null;
			if (!norm.id && key != null) return Object.assign({}, norm, { id: key });
			return norm;
		}).filter((v) => v != null);
	}
	function _meta(collection, path, operation, extra = {}) {
		return Object.assign({
			source: SOURCE,
			collection,
			path,
			operation
		}, extra);
	}
	function _safeId$1(raw) {
		return String(raw).replace(/[/$.[\]#]/g, "-").replace(/\.\./g, "--");
	}
	var EnergyCreditsFirebaseRepository = class {
		constructor(firebaseClient = null, options = {}) {
			this._client = firebaseClient;
			this._options = options && typeof options === "object" ? options : {};
		}
		_hasClient() {
			return this._client !== null && this._client !== void 0 && typeof this._client.get === "function" && typeof this._client.set === "function";
		}
		_failNoClient(operation) {
			return EnergyCreditsRepositoryResult.fail([EnergyCreditsRepositoryResult.makeError("NO_FIREBASE_CLIENT", `[EnergyCreditsFirebaseRepository.${operation}] firebaseClient não fornecido ou inválido`)]);
		}
		_failClientError(e, operation, collection, path) {
			return EnergyCreditsRepositoryResult.fail([EnergyCreditsRepositoryResult.makeError("ENERGY_CREDITS_FIREBASE_OPERATION_FAILED", `[${operation}] ${e && e.message ? e.message : String(e)}`)], [], _meta(collection, path, operation, { error: e && e.message ? e.message : String(e) }));
		}
		async _save(collection, entity, allowFileUrl = false) {
			if (!entity || typeof entity !== "object" || Array.isArray(entity)) return EnergyCreditsRepositoryResult.fail([EnergyCreditsRepositoryResult.makeError("REQUIRED", "entity é obrigatório", "entity")]);
			if (!entity.id || typeof entity.id !== "string" || !entity.id.trim()) return EnergyCreditsRepositoryResult.fail([EnergyCreditsRepositoryResult.makeError("REQUIRED", "id é obrigatório", "id")]);
			if (!this._hasClient()) return this._failNoClient("save");
			const norm = _normSecure(entity, allowFileUrl);
			let path;
			try {
				path = buildEnergyCreditsPath(collection, norm.id);
			} catch (e) {
				return EnergyCreditsRepositoryResult.fail([EnergyCreditsRepositoryResult.makeError("INVALID_ID", e.message, "id")]);
			}
			try {
				await this._client.set(path, norm);
				return EnergyCreditsRepositoryResult.ok(Object.assign({}, norm), [], _meta(collection, path, "save"));
			} catch (e) {
				return this._failClientError(e, "save", collection, path);
			}
		}
		async _get(collection, id) {
			if (!id || typeof id !== "string") return EnergyCreditsRepositoryResult.fail([EnergyCreditsRepositoryResult.makeError("REQUIRED", "id é obrigatório", "id")]);
			if (!this._hasClient()) return this._failNoClient("get");
			let path;
			try {
				path = buildEnergyCreditsPath(collection, id);
			} catch (e) {
				return EnergyCreditsRepositoryResult.fail([EnergyCreditsRepositoryResult.makeError("INVALID_ID", e.message, "id")]);
			}
			const allowFileUrl = collection === "creditDocuments";
			try {
				const raw = await this._client.get(path);
				const data = raw != null ? Object.assign({}, _normSecure(raw, allowFileUrl)) : null;
				return EnergyCreditsRepositoryResult.ok(data, [], _meta(collection, path, "get"));
			} catch (e) {
				return this._failClientError(e, "get", collection, path);
			}
		}
		async _list(collection, filters = {}, allowFileUrl = false) {
			if (!this._hasClient()) return this._failNoClient("list");
			const colPath = buildEnergyCreditsCollectionPath(collection);
			try {
				const filtered = _applyFilters$2(_rawToArray(await this._client.get(colPath), allowFileUrl), filters).sort((a, b) => (a.id || "").localeCompare(b.id || ""));
				return EnergyCreditsRepositoryResult.ok(filtered, [], _meta(collection, colPath, "list", { count: filtered.length }));
			} catch (e) {
				return this._failClientError(e, "list", collection, colPath);
			}
		}
		_auditLogId(entry) {
			if (entry.id && typeof entry.id === "string" && entry.id.trim()) return _safeId$1(entry.id.trim());
			const { targetType, targetId, action, createdAt } = entry;
			if (targetType && targetId && action && createdAt) return _safeId$1(`${targetType}::${targetId}::${action}::${createdAt}`);
			return null;
		}
		async saveGeneratingUnit(unit) {
			return this._save("generatingUnits", unit);
		}
		async getGeneratingUnit(id) {
			return this._get("generatingUnits", id);
		}
		async listGeneratingUnits(filters = {}) {
			return this._list("generatingUnits", filters);
		}
		async saveBeneficiaryUnit(unit) {
			return this._save("beneficiaryUnits", unit);
		}
		async getBeneficiaryUnit(id) {
			return this._get("beneficiaryUnits", id);
		}
		async listBeneficiaryUnits(filters = {}) {
			return this._list("beneficiaryUnits", filters);
		}
		async saveGeneratingUnitMonthlyRecord(record) {
			return this._save("generatingUnitMonthlyRecords", record);
		}
		async getGeneratingUnitMonthlyRecord(id) {
			return this._get("generatingUnitMonthlyRecords", id);
		}
		async listGeneratingUnitMonthlyRecords(filters = {}) {
			return this._list("generatingUnitMonthlyRecords", filters);
		}
		async saveBeneficiaryMonthlyRecord(record) {
			return this._save("beneficiaryMonthlyRecords", record);
		}
		async getBeneficiaryMonthlyRecord(id) {
			return this._get("beneficiaryMonthlyRecords", id);
		}
		async listBeneficiaryMonthlyRecords(filters = {}) {
			return this._list("beneficiaryMonthlyRecords", filters);
		}
		async saveCreditAllocation(alloc) {
			return this._save("creditAllocations", alloc);
		}
		async getCreditAllocation(id) {
			return this._get("creditAllocations", id);
		}
		async listCreditAllocations(filters = {}) {
			return this._list("creditAllocations", filters);
		}
		async saveOwnerSettlement(settlement) {
			return this._save("ownerSettlements", settlement);
		}
		async getOwnerSettlement(id) {
			return this._get("ownerSettlements", id);
		}
		async listOwnerSettlements(filters = {}) {
			return this._list("ownerSettlements", filters);
		}
		async saveEsaInvoice(invoice) {
			return this._save("esaInvoices", invoice);
		}
		async getEsaInvoice(id) {
			return this._get("esaInvoices", id);
		}
		async listEsaInvoices(filters = {}) {
			return this._list("esaInvoices", filters);
		}
		async saveMonthlyReport(report) {
			return this._save("monthlyReports", report);
		}
		async getMonthlyReport(id) {
			return this._get("monthlyReports", id);
		}
		async listMonthlyReports(filters = {}) {
			return this._list("monthlyReports", filters);
		}
		async saveCreditDocument(doc) {
			return this._save("creditDocuments", doc, true);
		}
		async getCreditDocument(id) {
			return this._get("creditDocuments", id);
		}
		async listCreditDocuments(filters = {}) {
			return this._list("creditDocuments", filters, true);
		}
		async saveBeneficiaryCreditBalanceRecord(record) {
			return this._save("beneficiaryCreditBalanceRecords", record);
		}
		async getBeneficiaryCreditBalanceRecord(id) {
			return this._get("beneficiaryCreditBalanceRecords", id);
		}
		async listBeneficiaryCreditBalanceRecords(filters = {}) {
			return this._list("beneficiaryCreditBalanceRecords", filters);
		}
		async saveUtilityBillImport(record) {
			return this._save("utilityBillImports", record);
		}
		async getUtilityBillImport(id) {
			return this._get("utilityBillImports", id);
		}
		async listUtilityBillImports(filters = {}) {
			return this._list("utilityBillImports", filters);
		}
		async appendCreditAuditLog(entry) {
			if (!entry || typeof entry !== "object" || Array.isArray(entry)) return EnergyCreditsRepositoryResult.fail([EnergyCreditsRepositoryResult.makeError("REQUIRED", "entry é obrigatório", "entry")]);
			const id = this._auditLogId(entry);
			if (!id) return EnergyCreditsRepositoryResult.fail([EnergyCreditsRepositoryResult.makeError("REQUIRED", "id ou (targetType + targetId + action + createdAt) são obrigatórios")]);
			return this._save("creditAuditLog", {
				...entry,
				id
			}, false);
		}
		async listCreditAuditLog(filters = {}) {
			return this._list("creditAuditLog", filters);
		}
		async getSnapshot(options = {}) {
			if (!this._hasClient()) return this._failNoClient("getSnapshot");
			const load = (col) => this._list(col, {}, col === "creditDocuments");
			try {
				const [gen, ben, genR, benR, alloc, sett, inv, rep, doc, audit, balRec, ubImports] = await Promise.all([
					load("generatingUnits"),
					load("beneficiaryUnits"),
					load("generatingUnitMonthlyRecords"),
					load("beneficiaryMonthlyRecords"),
					load("creditAllocations"),
					load("ownerSettlements"),
					load("esaInvoices"),
					load("monthlyReports"),
					load("creditDocuments"),
					load("creditAuditLog"),
					load("beneficiaryCreditBalanceRecords"),
					load("utilityBillImports")
				]);
				const failed = [
					gen,
					ben,
					genR,
					benR,
					alloc,
					sett,
					inv,
					rep,
					doc,
					audit,
					balRec,
					ubImports
				].find((r) => !r.ok);
				if (failed) return failed;
				return EnergyCreditsRepositoryResult.ok({
					generatingUnits: gen.data,
					beneficiaryUnits: ben.data,
					generatingUnitMonthlyRecords: genR.data,
					beneficiaryMonthlyRecords: benR.data,
					creditAllocations: alloc.data,
					ownerSettlements: sett.data,
					esaInvoices: inv.data,
					monthlyReports: rep.data,
					creditDocuments: doc.data,
					creditAuditLog: audit.data,
					beneficiaryCreditBalanceRecords: balRec.data,
					utilityBillImports: ubImports.data
				}, [], {
					source: SOURCE,
					referenceDate: options.referenceDate || null
				});
			} catch (e) {
				return this._failClientError(e, "getSnapshot", "all", "");
			}
		}
		getStats() {
			return {
				type: "firebase",
				hasClient: this._hasClient(),
				clientMethods: [
					"get",
					"set",
					"remove"
				].filter((m) => this._client && typeof this._client[m] === "function")
			};
		}
	};
	//#endregion
	//#region ../../../repositories/energy-credits/energy-credits-repository-hydrator.js
	/**
	* ESA OS — Repositories / Energy Credits
	* Adapter: Repository → Read Model
	*
	* Responsabilidade única: chamar repository.getSnapshot() e passar o resultado
	* para readModel.hydrate(). Nenhuma lógica de transformação — apenas ponte.
	*/
	var EnergyCreditsRepositoryHydrator = class {
		constructor(repository = null, readModel = null) {
			this._repository = repository;
			this._readModel = readModel;
		}
		hydrateReadModel(options = {}) {
			if (!this._repository || typeof this._repository.getSnapshot !== "function") return EnergyCreditsRepositoryResult.fail([EnergyCreditsRepositoryResult.makeError("INVALID_REPOSITORY", "repository inválido ou não fornecido")]);
			if (!this._readModel || typeof this._readModel.hydrate !== "function") return EnergyCreditsRepositoryResult.fail([EnergyCreditsRepositoryResult.makeError("INVALID_READ_MODEL", "readModel inválido ou não fornecido")]);
			const snapshotResult = this._repository.getSnapshot(options);
			if (!snapshotResult.ok) return snapshotResult;
			const hydrateStats = this._readModel.hydrate(snapshotResult.data, options);
			return EnergyCreditsRepositoryResult.ok(hydrateStats, [], {
				source: "memory-repository",
				hydrateStats
			});
		}
	};
	//#endregion
	//#region ../../../repositories/energy-credits/index.js
	var energyCreditsRepository = new EnergyCreditsMemoryRepository();
	var energyCreditsRepositoryHydrator = new EnergyCreditsRepositoryHydrator(energyCreditsRepository, energyCreditsReadModel);
	//#endregion
	//#region ../../../importers/energy-credits/import-types.js
	/**
	* ESA OS — Importers / Energy Credits
	* Constantes de tipos de importação suportados.
	*/
	var ENERGY_CREDITS_IMPORT_TYPE = Object.freeze({
		GENERATING_UNITS: "generating-units",
		BENEFICIARY_UNITS: "beneficiary-units",
		GENERATING_UNIT_MONTHLY_RECORDS: "generating-unit-monthly-records",
		BENEFICIARY_MONTHLY_RECORDS: "beneficiary-monthly-records"
	});
	var EC_IMPORT_TYPES = Object.freeze(Object.values(ENERGY_CREDITS_IMPORT_TYPE));
	//#endregion
	//#region ../../../importers/energy-credits/energy-credits-import-result.js
	/**
	* ESA OS — Importers / Energy Credits
	* Contrato de resultado para operações de importação.
	*
	* Nunca lança exception para erro esperado de importação.
	* Contrato: { ok, data, errors, warnings, metadata }
	*/
	var EnergyCreditsImportResult = class {
		static ok(data, errors = [], warnings = [], metadata = {}) {
			return Object.freeze({
				ok: true,
				data,
				errors: Array.isArray(errors) ? errors : [],
				warnings: Array.isArray(warnings) ? warnings : [],
				metadata: metadata && typeof metadata === "object" ? metadata : {}
			});
		}
		static fail(errors = [], warnings = [], metadata = {}) {
			return Object.freeze({
				ok: false,
				data: null,
				errors: Array.isArray(errors) ? errors : [errors].filter(Boolean),
				warnings: Array.isArray(warnings) ? warnings : [],
				metadata: metadata && typeof metadata === "object" ? metadata : {}
			});
		}
		static makeError(code, message, row = null, field = null, value = null, meta = {}) {
			return Object.freeze({
				code,
				message,
				row: row !== void 0 ? row : null,
				field: field !== void 0 ? field : null,
				value: value !== void 0 ? value : null,
				metadata: meta && typeof meta === "object" ? meta : {}
			});
		}
		static makeWarning(code, message, row = null, field = null, value = null, meta = {}) {
			return Object.freeze({
				code,
				message,
				row: row !== void 0 ? row : null,
				field: field !== void 0 ? field : null,
				value: value !== void 0 ? value : null,
				metadata: meta && typeof meta === "object" ? meta : {}
			});
		}
	};
	//#endregion
	//#region ../../../importers/energy-credits/csv-parser.js
	/**
	* ESA OS — Importers / Energy Credits
	* Parser CSV determinístico, sem dependências externas.
	*
	* NÃO acessa filesystem.
	* NÃO acessa window.
	* NÃO usa FileReader.
	* Suporta delimitador "," e ";", autodetecção, BOM, aspas, aspas escapadas "".
	*/
	function _removeBom(text) {
		return text.replace(/^﻿/, "");
	}
	function _normalizeEndings(text) {
		return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
	}
	function _detectDelimiter(firstLine, preferred) {
		if (preferred === "," || preferred === ";") return preferred;
		const commas = (firstLine.match(/,/g) || []).length;
		return (firstLine.match(/;/g) || []).length > commas ? ";" : ",";
	}
	function _parseLine(line, delimiter) {
		const fields = [];
		let current = "";
		let inQuotes = false;
		for (let i = 0; i < line.length; i++) {
			const ch = line[i];
			const next = line[i + 1];
			if (inQuotes) if (ch === "\"" && next === "\"") {
				current += "\"";
				i++;
			} else if (ch === "\"") inQuotes = false;
			else current += ch;
			else if (ch === "\"") inQuotes = true;
			else if (ch === delimiter) {
				fields.push(current);
				current = "";
			} else current += ch;
		}
		fields.push(current);
		return fields;
	}
	function _parseRows(lines, headers, delimiter, doTrim, skipEmpty) {
		const rows = [];
		for (let i = 1; i < lines.length; i++) {
			const line = lines[i];
			if (skipEmpty && (!line || !line.trim())) continue;
			const values = _parseLine(line, delimiter);
			const row = {};
			for (let j = 0; j < headers.length; j++) {
				const key = headers[j];
				const val = values[j] !== void 0 ? values[j] : "";
				row[key] = doTrim ? val.trim() : val;
			}
			rows.push(row);
		}
		return rows;
	}
	/**
	* Parseia CSV em array de objetos com os headers como chaves.
	*
	* @param {string} csvText
	* @param {object} options
	* @param {string}  [options.delimiter]           - Forçar delimitador ',' ou ';'
	* @param {boolean} [options.autoDetectDelimiter] - Autodetectar delimitador (default: true)
	* @param {boolean} [options.trim]                - Trim em chaves e valores (default: true)
	* @param {boolean} [options.skipEmptyLines]      - Ignorar linhas vazias (default: true)
	* @returns {EnergyCreditsImportResult}
	*/
	function parseCsv(csvText, options = {}) {
		if (!csvText || typeof csvText !== "string") return EnergyCreditsImportResult.fail([EnergyCreditsImportResult.makeError("INVALID_CSV", "csvText deve ser string não-vazia")]);
		const lines = _normalizeEndings(_removeBom(csvText)).split("\n");
		const firstLine = lines[0] || "";
		if (!firstLine.trim()) return EnergyCreditsImportResult.fail([EnergyCreditsImportResult.makeError("EMPTY_CSV", "CSV não contém header")]);
		const doTrim = options.trim !== false;
		const skipEmpty = options.skipEmptyLines !== false;
		const delimiter = _detectDelimiter(firstLine, options.delimiter);
		const headers = _parseLine(firstLine, delimiter).map((h) => doTrim ? h.trim() : h);
		if (headers.every((h) => !h)) return EnergyCreditsImportResult.fail([EnergyCreditsImportResult.makeError("INVALID_HEADER", "Header do CSV está vazio")]);
		const rows = _parseRows(lines, headers, delimiter, doTrim, skipEmpty);
		return EnergyCreditsImportResult.ok(rows, [], [], {
			totalLines: lines.length - 1,
			totalRows: rows.length,
			delimiter,
			headers
		});
	}
	//#endregion
	//#region ../../../importers/energy-credits/energy-credits-import-mapper.js
	/**
	* ESA OS — Importers / Energy Credits
	* Mapper: linhas tabulares → entidades internas.
	*
	* Aliases em PT e EN.
	* Normalização de números BR/US/moeda/kWh.
	* Normalização de mês (YYYY-MM, MM/YYYY, jan/YYYY, janeiro/YYYY).
	* Geração de IDs determinísticos.
	* Remoção de campos sensíveis.
	* NÃO usa Date.now(), Math.random(), crypto.randomUUID().
	*/
	var FORBIDDEN_ID_CHARS = [
		"/",
		"..",
		"#",
		"$",
		"[",
		"]"
	];
	var FORBIDDEN_KEYS$2 = /* @__PURE__ */ new Set([
		"password",
		"passHash",
		"sessionToken",
		"sessionExpiresAt",
		"serviceAccount",
		"firebaseConfig",
		"apiKey",
		"secret",
		"downloadUrl",
		"stack",
		"stackTrace",
		"internalLog"
	]);
	var MONTH_ABR = {
		jan: "01",
		fev: "02",
		mar: "03",
		abr: "04",
		mai: "05",
		jun: "06",
		jul: "07",
		ago: "08",
		set: "09",
		out: "10",
		nov: "11",
		dez: "12"
	};
	var MONTH_FULL = {
		janeiro: "01",
		fevereiro: "02",
		março: "03",
		abril: "04",
		maio: "05",
		junho: "06",
		julho: "07",
		agosto: "08",
		setembro: "09",
		outubro: "10",
		novembro: "11",
		dezembro: "12"
	};
	var T$2 = ENERGY_CREDITS_IMPORT_TYPE;
	function _resolve(row, ...aliases) {
		for (const a of aliases) {
			const v = row[a];
			if (v !== void 0 && v !== null && v !== "") return v;
		}
		return null;
	}
	function _normalizeNumber(raw) {
		if (raw === null || raw === void 0 || raw === "") return null;
		let str = String(raw).replace(/^R\$\s*/, "").replace(/kWh$/i, "").replace(/\s+/g, "").trim();
		if (!str) return null;
		const dotIdx = str.lastIndexOf(".");
		const commaIdx = str.lastIndexOf(",");
		let normalized;
		if (dotIdx !== -1 && commaIdx !== -1) normalized = dotIdx > commaIdx ? str.replace(/,/g, "") : str.replace(/\./g, "").replace(",", ".");
		else if (commaIdx !== -1) normalized = str.replace(",", ".");
		else if (dotIdx !== -1) normalized = str.slice(dotIdx + 1).length === 3 ? str.replace(/\./g, "") : str;
		else normalized = str;
		const num = Number(normalized);
		return isNaN(num) ? null : num;
	}
	function _normalizeMonth$1(raw) {
		if (!raw || typeof raw !== "string") return null;
		const s = raw.trim();
		const lower = s.toLowerCase();
		if (/^\d{4}-\d{2}$/.test(s)) return s;
		if (/^\d{1,2}\/\d{4}$/.test(s)) {
			const [m, y] = s.split("/");
			return `${y}-${m.padStart(2, "0")}`;
		}
		if (/^\d{4}\/\d{1,2}$/.test(s)) {
			const [y, m] = s.split("/");
			return `${y}-${m.padStart(2, "0")}`;
		}
		for (const [a, n] of Object.entries(MONTH_ABR)) if (lower.startsWith(a + "/")) {
			const y = lower.slice(a.length + 1);
			if (/^\d{4}$/.test(y)) return `${y}-${n}`;
		}
		for (const [f, n] of Object.entries(MONTH_FULL)) if (lower.startsWith(f + "/")) {
			const y = lower.slice(f.length + 1);
			if (/^\d{4}$/.test(y)) return `${y}-${n}`;
		}
		return null;
	}
	function _removeAccents(str) {
		return String(str).normalize("NFD").replace(/[̀-ͯ]/g, "");
	}
	function _safeId(raw) {
		if (!raw) return null;
		const id = String(raw).trim().replace(/\s+/g, "-");
		for (const c of FORBIDDEN_ID_CHARS) if (id.includes(c)) return null;
		return id || null;
	}
	function _generateId$1(prefix, ...parts) {
		return `${prefix}-${parts.filter((p) => p != null && String(p).trim()).map((p) => _removeAccents(String(p)).trim().replace(/\s+/g, "-")).join("-")}`;
	}
	function _makeErr(code, message, row, field) {
		return EnergyCreditsImportResult.makeError(code, message, row, field);
	}
	var EnergyCreditsImportMapper = class {
		mapRow(importType, row, rowIndex = null) {
			if (!row || typeof row !== "object") return {
				ok: false,
				entity: null,
				errors: [_makeErr("INVALID_ROW", "row deve ser objeto", rowIndex)],
				warnings: []
			};
			if (!FORBIDDEN_KEYS$2) {}
			const clean = {};
			for (const [k, v] of Object.entries(row)) if (!FORBIDDEN_KEYS$2.has(k)) clean[k] = v;
			switch (importType) {
				case T$2.GENERATING_UNITS: return this._mapGeneratingUnit(clean, rowIndex);
				case T$2.BENEFICIARY_UNITS: return this._mapBeneficiaryUnit(clean, rowIndex);
				case T$2.GENERATING_UNIT_MONTHLY_RECORDS: return this._mapGeneratingUnitMonthlyRecord(clean, rowIndex);
				case T$2.BENEFICIARY_MONTHLY_RECORDS: return this._mapBeneficiaryMonthlyRecord(clean, rowIndex);
				default: return {
					ok: false,
					entity: null,
					errors: [_makeErr("UNKNOWN_TYPE", `Tipo desconhecido: ${importType}`, rowIndex)],
					warnings: []
				};
			}
		}
		_mapGeneratingUnit(row, rowIndex) {
			const rawId = _resolve(row, "id", "codigo", "código");
			const name = _resolve(row, "name", "nome");
			const ownerName = _resolve(row, "ownerName", "proprietario", "proprietário", "dono");
			const ownerDocument = _resolve(row, "ownerDocument", "cpfCnpj", "cpf_cnpj", "documento");
			const uc = _resolve(row, "uc", "unidadeConsumidora", "unidade_consumidora");
			const utilityCompany = _resolve(row, "utilityCompany", "distribuidora", "concessionaria", "concessionária");
			const status = _resolve(row, "status");
			return {
				ok: true,
				entity: {
					id: rawId ? _safeId(rawId) : uc ? _generateId$1("ug", uc) : null,
					name: name || null,
					ownerName: ownerName || null,
					ownerDocument: ownerDocument || null,
					uc: uc || null,
					utilityCompany: utilityCompany || null,
					status: status || null
				},
				errors: [],
				warnings: []
			};
		}
		_mapBeneficiaryUnit(row, rowIndex) {
			const rawId = _resolve(row, "id", "codigo", "código");
			const generatingUnitId = _resolve(row, "generatingUnitId", "unidadeGeradoraId", "unidade_geradora_id", "ugId");
			const name = _resolve(row, "name", "nome");
			const document = _resolve(row, "document", "cpfCnpj", "cpf_cnpj", "documento");
			const uc = _resolve(row, "uc", "unidadeConsumidora", "unidade_consumidora");
			const utilityCompany = _resolve(row, "utilityCompany", "distribuidora", "concessionaria", "concessionária");
			const status = _resolve(row, "status");
			return {
				ok: true,
				entity: {
					id: rawId ? _safeId(rawId) : uc ? _generateId$1("ub", uc) : null,
					generatingUnitId: generatingUnitId || null,
					name: name || null,
					document: document || null,
					uc: uc || null,
					utilityCompany: utilityCompany || null,
					status: status || null
				},
				errors: [],
				warnings: []
			};
		}
		_mapGeneratingUnitMonthlyRecord(row, rowIndex) {
			const rawId = _resolve(row, "id", "codigo", "código");
			const generatingUnitId = _resolve(row, "generatingUnitId", "unidadeGeradoraId", "unidade_geradora_id", "ugId");
			const referenceMonth = _normalizeMonth$1(_resolve(row, "referenceMonth", "mesReferencia", "mêsReferência", "mes_referencia"));
			const prevBalance = _normalizeNumber(_resolve(row, "previousBalanceKwh", "saldoAnteriorKwh", "saldo_anterior_kwh"));
			const monthlyGen = _normalizeNumber(_resolve(row, "monthlyGenerationKwh", "geracaoMensalKwh", "geraçãoMensalKwh", "geracao_mensal_kwh"));
			const purchasePrice = _normalizeNumber(_resolve(row, "purchasePricePerKwh", "precoCompraKwh", "preçoCompraKwh", "preco_compra_kwh"));
			const status = _resolve(row, "status");
			return {
				ok: true,
				entity: {
					id: rawId ? _safeId(rawId) : generatingUnitId && referenceMonth ? _generateId$1("ugm", generatingUnitId, referenceMonth) : null,
					generatingUnitId: generatingUnitId || null,
					referenceMonth: referenceMonth || null,
					previousBalanceKwh: prevBalance,
					monthlyGenerationKwh: monthlyGen,
					purchasePricePerKwh: purchasePrice,
					status: status || null
				},
				errors: [],
				warnings: []
			};
		}
		_mapBeneficiaryMonthlyRecord(row, rowIndex) {
			const rawId = _resolve(row, "id", "codigo", "código");
			const beneficiaryUnitId = _resolve(row, "beneficiaryUnitId", "unidadeBeneficiariaId", "unidade_beneficiaria_id", "ubId");
			const generatingUnitId = _resolve(row, "generatingUnitId", "unidadeGeradoraId", "unidade_geradora_id", "ugId");
			const referenceMonth = _normalizeMonth$1(_resolve(row, "referenceMonth", "mesReferencia", "mêsReferência", "mes_referencia"));
			const consumption = _normalizeNumber(_resolve(row, "monthlyConsumptionKwh", "consumoMensalKwh", "consumo_mensal_kwh"));
			const allocated = _normalizeNumber(_resolve(row, "allocatedKwh", "creditosAlocadosKwh", "créditosAlocadosKwh", "creditos_alocados_kwh"));
			const compensated = _normalizeNumber(_resolve(row, "compensatedKwh", "creditosCompensadosKwh", "créditosCompensadosKwh", "creditos_compensados_kwh"));
			const esaPrice = _normalizeNumber(_resolve(row, "esaPricePerKwh", "precoEsaKwh", "preçoEsaKwh", "preco_esa_kwh"));
			const utilityTariff = _normalizeNumber(_resolve(row, "utilityTariffPerKwh", "tarifaDistribuidoraKwh", "tarifa_distribuidora_kwh"));
			const paymentStatus = _resolve(row, "paymentStatus", "statusPagamento", "status_pagamento");
			const status = _resolve(row, "status");
			return {
				ok: true,
				entity: {
					id: rawId ? _safeId(rawId) : beneficiaryUnitId && referenceMonth ? _generateId$1("ubm", beneficiaryUnitId, referenceMonth) : null,
					beneficiaryUnitId: beneficiaryUnitId || null,
					generatingUnitId: generatingUnitId || null,
					referenceMonth: referenceMonth || null,
					monthlyConsumptionKwh: consumption,
					allocatedKwh: allocated,
					compensatedKwh: compensated,
					esaPricePerKwh: esaPrice,
					utilityTariffPerKwh: utilityTariff,
					paymentStatus: paymentStatus || null,
					status: status || null
				},
				errors: [],
				warnings: []
			};
		}
	};
	//#endregion
	//#region ../../../importers/energy-credits/energy-credits-import-validator.js
	/**
	* ESA OS — Importers / Energy Credits
	* Validator: verifica entidades mapeadas antes da persistência.
	*
	* NÃO lança exceptions.
	* Retorna erros e warnings estruturados.
	* NÃO acessa Firebase, filesystem ou rede.
	*/
	var T$1 = ENERGY_CREDITS_IMPORT_TYPE;
	function _err$1(code, message, row = null, field = null, value = null) {
		return EnergyCreditsImportResult.makeError(code, message, row, field, value);
	}
	function _warn$1(code, message, row = null, field = null, value = null) {
		return EnergyCreditsImportResult.makeWarning(code, message, row, field, value);
	}
	function _requirePositiveNumber(entity, field, row) {
		const v = entity[field];
		if (v === null || v === void 0) return null;
		if (typeof v !== "number" || isNaN(v)) return _err$1("INVALID_NUMBER", `Campo deve ser número: ${field}`, row, field, v);
		if (v < 0) return _warn$1("NEGATIVE_NUMBER", `Número negativo em: ${field}`, row, field, v);
		return null;
	}
	function _requireMonth(entity, field, row) {
		const v = entity[field];
		if (!v || typeof v !== "string" || !/^\d{4}-\d{2}$/.test(v)) return _err$1("INVALID_MONTH", `Campo deve ser YYYY-MM: ${field}`, row, field, v);
		return null;
	}
	var EnergyCreditsImportValidator = class {
		validate(importType, entity, rowIndex = null) {
			switch (importType) {
				case T$1.GENERATING_UNITS: return this._validateGeneratingUnit(entity, rowIndex);
				case T$1.BENEFICIARY_UNITS: return this._validateBeneficiaryUnit(entity, rowIndex);
				case T$1.GENERATING_UNIT_MONTHLY_RECORDS: return this._validateGeneratingUnitMonthlyRecord(entity, rowIndex);
				case T$1.BENEFICIARY_MONTHLY_RECORDS: return this._validateBeneficiaryMonthlyRecord(entity, rowIndex);
				default: return {
					ok: false,
					errors: [_err$1("UNKNOWN_TYPE", `Tipo desconhecido: ${importType}`, rowIndex)],
					warnings: []
				};
			}
		}
		_validateGeneratingUnit(entity, rowIndex) {
			const errors = [];
			const warnings = [];
			if (!entity.id) warnings.push(_warn$1("MISSING_ID", "Unidade geradora sem ID — será gerado automaticamente", rowIndex, "id"));
			if (!entity.name) warnings.push(_warn$1("MISSING_NAME", "Campo name está ausente", rowIndex, "name"));
			if (!entity.uc && !entity.id) errors.push(_err$1("MISSING_IDENTIFIER", "É necessário id ou uc para identificar a unidade geradora", rowIndex, "uc"));
			return {
				ok: errors.length === 0,
				errors,
				warnings
			};
		}
		_validateBeneficiaryUnit(entity, rowIndex) {
			const errors = [];
			const warnings = [];
			if (!entity.id) warnings.push(_warn$1("MISSING_ID", "Unidade beneficiária sem ID — será gerado automaticamente", rowIndex, "id"));
			if (!entity.name) warnings.push(_warn$1("MISSING_NAME", "Campo name está ausente", rowIndex, "name"));
			if (!entity.uc && !entity.id) errors.push(_err$1("MISSING_IDENTIFIER", "É necessário id ou uc para identificar a unidade beneficiária", rowIndex, "uc"));
			return {
				ok: errors.length === 0,
				errors,
				warnings
			};
		}
		_validateGeneratingUnitMonthlyRecord(entity, rowIndex) {
			const errors = [];
			const warnings = [];
			const monthErr = _requireMonth(entity, "referenceMonth", rowIndex);
			if (monthErr) errors.push(monthErr);
			if (!entity.generatingUnitId && !entity.id) errors.push(_err$1("MISSING_IDENTIFIER", "É necessário generatingUnitId ou id para o registro mensal", rowIndex, "generatingUnitId"));
			for (const f of [
				"previousBalanceKwh",
				"monthlyGenerationKwh",
				"purchasePricePerKwh"
			]) {
				const w = _requirePositiveNumber(entity, f, rowIndex);
				if (w) (w.code === "INVALID_NUMBER" ? errors : warnings).push(w);
			}
			return {
				ok: errors.length === 0,
				errors,
				warnings
			};
		}
		_validateBeneficiaryMonthlyRecord(entity, rowIndex) {
			const errors = [];
			const warnings = [];
			const monthErr = _requireMonth(entity, "referenceMonth", rowIndex);
			if (monthErr) errors.push(monthErr);
			if (!entity.beneficiaryUnitId && !entity.id) errors.push(_err$1("MISSING_IDENTIFIER", "É necessário beneficiaryUnitId ou id para o registro mensal", rowIndex, "beneficiaryUnitId"));
			for (const f of [
				"monthlyConsumptionKwh",
				"allocatedKwh",
				"compensatedKwh",
				"esaPricePerKwh",
				"utilityTariffPerKwh"
			]) {
				const w = _requirePositiveNumber(entity, f, rowIndex);
				if (w) (w.code === "INVALID_NUMBER" ? errors : warnings).push(w);
			}
			return {
				ok: errors.length === 0,
				errors,
				warnings
			};
		}
	};
	//#endregion
	//#region ../../../importers/energy-credits/energy-credits-import-service.js
	/**
	* ESA OS — Importers / Energy Credits
	* ImportService: orquestra parse → map → validate → persist → hydrate.
	*
	* NÃO acessa filesystem.
	* NÃO acessa Firebase real.
	* NÃO usa Date.now(), Math.random(), crypto.randomUUID().
	* persist=false por padrão; hydrateReadModel=false por padrão.
	*/
	var T = ENERGY_CREDITS_IMPORT_TYPE;
	var SAVE_MAP = Object.freeze({
		[T.GENERATING_UNITS]: "GeneratingUnit",
		[T.BENEFICIARY_UNITS]: "BeneficiaryUnit",
		[T.GENERATING_UNIT_MONTHLY_RECORDS]: "GeneratingUnitMonthlyRecord",
		[T.BENEFICIARY_MONTHLY_RECORDS]: "BeneficiaryMonthlyRecord"
	});
	var EnergyCreditsImportService = class {
		constructor(mapper = null, validator = null, parser = null) {
			this._mapper = mapper || new EnergyCreditsImportMapper();
			this._validator = validator || new EnergyCreditsImportValidator();
			this._parser = parser || parseCsv;
		}
		importFromCsv(importType, csvText, options = {}) {
			const parsed = this._parser(csvText, options.csv || {});
			if (!parsed.ok) return EnergyCreditsImportResult.fail(parsed.errors, parsed.warnings, {
				importType,
				stage: "parse"
			});
			return this._processImport(importType, parsed.data, options, {
				...parsed.metadata,
				stage: "import"
			});
		}
		importFromRows(importType, rows, options = {}) {
			if (!Array.isArray(rows)) return EnergyCreditsImportResult.fail([EnergyCreditsImportResult.makeError("INVALID_ROWS", "rows deve ser Array")], [], {
				importType,
				stage: "validate-input"
			});
			if (!EC_IMPORT_TYPES.includes(importType)) return EnergyCreditsImportResult.fail([EnergyCreditsImportResult.makeError("UNKNOWN_TYPE", `Tipo desconhecido: ${importType}`)], [], {
				importType,
				stage: "validate-input"
			});
			return this._processImport(importType, rows, options, {
				totalRows: rows.length,
				stage: "import"
			});
		}
		_processImport(importType, rows, options, baseMeta) {
			const { entities, errors, warnings } = this._mapAndValidate(importType, rows);
			const allErrors = [...errors];
			const allWarnings = [...warnings];
			if (options.persist && entities.length > 0) {
				const persistErrs = this._persist(importType, entities, options.repository);
				allErrors.push(...persistErrs);
			}
			if (options.hydrateReadModel && entities.length > 0 && options.hydrator) {
				const hydrateErrs = this._hydrate(importType, entities, options.hydrator);
				allWarnings.push(...hydrateErrs);
			}
			return this._wrapResult(entities, allErrors, allWarnings, baseMeta, importType);
		}
		_mapAndValidate(importType, rows) {
			const entities = [];
			const errors = [];
			const warnings = [];
			for (let i = 0; i < rows.length; i++) {
				const mapped = this._mapper.mapRow(importType, rows[i], i);
				if (!mapped.ok) {
					errors.push(...mapped.errors);
					continue;
				}
				const validated = this._validator.validate(importType, mapped.entity, i);
				warnings.push(...validated.warnings);
				if (!validated.ok) {
					errors.push(...validated.errors);
					continue;
				}
				entities.push(mapped.entity);
			}
			return {
				entities,
				errors,
				warnings
			};
		}
		_persist(importType, entities, repository) {
			const errors = [];
			const saveMethod = SAVE_MAP[importType];
			if (!repository || typeof repository[`save${saveMethod}`] !== "function") {
				errors.push(EnergyCreditsImportResult.makeError("NO_REPOSITORY", `Repository não suporta save para: ${importType}`));
				return errors;
			}
			const method = `save${saveMethod}`;
			for (const entity of entities) try {
				const result = repository[method](entity);
				if (result && result.ok === false) errors.push(EnergyCreditsImportResult.makeError("PERSIST_ERROR", result.error || "Erro ao salvar entidade", null, "id", entity.id));
			} catch (e) {
				errors.push(EnergyCreditsImportResult.makeError("PERSIST_EXCEPTION", String(e.message || e), null, "id", entity.id));
			}
			return errors;
		}
		_hydrate(importType, entities, hydrator) {
			const warnings = [];
			if (typeof hydrator.hydrate !== "function") {
				warnings.push(EnergyCreditsImportResult.makeWarning("NO_HYDRATOR", "Hydrator não possui método hydrate — ignorando"));
				return warnings;
			}
			try {
				hydrator.hydrate();
			} catch (e) {
				warnings.push(EnergyCreditsImportResult.makeWarning("HYDRATE_FAILED", String(e.message || e)));
			}
			return warnings;
		}
		_wrapResult(entities, errors, warnings, meta, importType) {
			const ok = errors.length === 0;
			const metadata = Object.assign({}, meta, {
				importType,
				totalEntities: entities.length,
				totalErrors: errors.length,
				totalWarnings: warnings.length
			});
			return ok ? EnergyCreditsImportResult.ok(entities, [], warnings, metadata) : EnergyCreditsImportResult.fail(errors, warnings, metadata);
		}
	};
	//#endregion
	//#region ../../../importers/energy-credits/index.js
	var energyCreditsImportService = new EnergyCreditsImportService();
	//#endregion
	//#region ../../../engines/energy-billing/currency-parser.js
	/**
	* ESA OS — Engines / Energy Billing
	* Currency Parser — pt-BR e US.
	*
	* Regra crítica: "0,60" significa R$ 0,60 (não R$ 60,00).
	* A vírgula isolada é separador decimal, não de milhar.
	*
	* NÃO usa Date.now, Math.random, Firebase, window, localStorage.
	*/
	/**
	* Converte string monetária para número.
	* Formatos suportados: 0,60 | 0.60 | R$ 0,60 | 1.234,56 | 1,234.56 | 1.250,50
	*
	* @param {*} raw
	* @returns {number|null}
	*/
	function parseCurrency(raw) {
		if (raw === null || raw === void 0 || raw === "") return null;
		let str = String(raw).trim().replace(/^R\$\s*/, "").replace(/\s+/g, "");
		if (!str) return null;
		const dotIdx = str.lastIndexOf(".");
		const commaIdx = str.lastIndexOf(",");
		let normalized;
		if (dotIdx !== -1 && commaIdx !== -1) normalized = dotIdx > commaIdx ? str.replace(/,/g, "") : str.replace(/\./g, "").replace(",", ".");
		else if (commaIdx !== -1) normalized = str.replace(",", ".");
		else if (dotIdx !== -1) normalized = str.slice(dotIdx + 1).length === 3 ? str.replace(".", "") : str;
		else normalized = str;
		const num = Number(normalized);
		return isNaN(num) ? null : num;
	}
	//#endregion
	//#region ../../../engines/energy-billing/energy-billing-result.js
	/**
	* ESA OS — Engines / Energy Billing
	* Contrato de resultado do Billing Engine.
	*
	* Imutável. Nunca lança exception para erros esperados de cálculo.
	*/
	var EnergyBillingResult = class {
		static ok(snapshot, warnings = [], metadata = {}) {
			return Object.freeze({
				ok: true,
				snapshot: Object.freeze(snapshot),
				errors: [],
				warnings: Array.isArray(warnings) ? warnings : [],
				metadata: metadata && typeof metadata === "object" ? metadata : {}
			});
		}
		static fail(errors = [], warnings = [], metadata = {}) {
			return Object.freeze({
				ok: false,
				snapshot: null,
				errors: Array.isArray(errors) ? errors : [errors].filter(Boolean),
				warnings: Array.isArray(warnings) ? warnings : [],
				metadata: metadata && typeof metadata === "object" ? metadata : {}
			});
		}
		static makeError(code, message, field = null, value = null) {
			return Object.freeze({
				code,
				message,
				field,
				value
			});
		}
		static makeWarning(code, message, field = null, value = null) {
			return Object.freeze({
				code,
				message,
				field,
				value
			});
		}
		toJSON() {
			return this;
		}
	};
	var CALCULATION_SOURCE = "legacy-copel-calculator";
	/**
	* Monta e congela o snapshot de faturamento.
	*
	* @param {object} params
	* @returns {object} frozen snapshot
	*/
	function buildBillingSnapshot(params) {
		const { referenceMonth = null, generatingUnitId = null, beneficiaryUnitId = null, inputs, mem, settlementRecipient = null, metadata = {} } = params;
		return Object.freeze({
			snapshotVersion: "1.0",
			calculationSource: CALCULATION_SOURCE,
			referenceMonth,
			generatingUnitId,
			beneficiaryUnitId,
			inputs: Object.freeze({ ...inputs }),
			contaConcessionaria: Object.freeze(_contaConcessionaria(mem)),
			contaEsa: Object.freeze(_contaEsa(mem)),
			economiaMensal: mem.eco_mensal,
			economiaPercentual: mem.eco_pct,
			economiaAnual: mem.eco_anual,
			componentesTarifarios: Object.freeze(_componentesTarifarios(mem)),
			creditos: Object.freeze(_creditos(mem)),
			settlementRecipient: settlementRecipient ? Object.freeze(_safeRecipient(settlementRecipient)) : null,
			calculationMemory: Object.freeze({ ...mem }),
			metadata: Object.freeze({
				...metadata,
				generatedAt: null
			})
		});
	}
	function _contaConcessionaria(m) {
		return {
			total: m.c_fat,
			te: m.c_te,
			tusd: m.c_tusd,
			cip: m.cip,
			taxes: Object.freeze({
				icms: m.c_icms,
				cofins: m.c_cofins,
				pis: m.c_pis,
				total: m.c_imp
			})
		};
	}
	function _contaEsa(m) {
		return {
			total: m.gd2_liq_final,
			fioB: m.gd2_tus_liq,
			cip: m.cip,
			vendaKwh: m.venda_kwh,
			custoMinimoSemCip: m.custo_min_sc,
			taxes: Object.freeze({
				icms: m.gd2_icms,
				cofins: m.gd2_cofins,
				pis: m.gd2_pis,
				total: m.gd2_imp
			})
		};
	}
	function _componentesTarifarios(m) {
		return {
			te: m.c_te,
			tusd: m.c_tusd,
			fioB: m.fio_b,
			bandeira: m.bndv,
			cip: m.cip,
			custoMinimo: Object.freeze({
				comCip: m.custo_min,
				semCip: m.custo_min_sc
			})
		};
	}
	function _creditos(m) {
		return {
			disponiveis: m.cred_disp,
			compensados: m.cred_comp_uc,
			excedentes: m.cred_excedente,
			vendaKwh: m.geracao - m.minimo,
			receitaBruta: m.rec_bruta,
			receitaLiquida: m.rec_liq
		};
	}
	function _safeRecipient(r) {
		return {
			recipientName: r.name || r.recipientName || null,
			recipientDocument: r.document || r.recipientDocument || null,
			pixKey: r.pixKey || null,
			pixKeyType: r.pixKeyType || null
		};
	}
	//#endregion
	//#region ../../../engines/energy-billing/legacy-copel-calculation-adapter.js
	/**
	* ESA OS — Engines / Energy Billing
	* Legacy COPEL Calculation Adapter
	*
	* Implementa literalmente a lógica da calculadora oficial ESA Energia.
	* Fonte: calculadora_html.html (index.html) do repositório esa-calculadora-energia.
	*
	* Preserva nomes de variáveis legacy para rastreabilidade.
	* Preserva ordem das operações.
	* Sem arredondamentos intermediários (idêntico ao JS original).
	* NÃO usa Date.now, Math.random, Firebase, window, localStorage.
	*/
	function _requireNumber(val, field) {
		const n = typeof val === "string" ? parseCurrency(val) : val;
		if (typeof n !== "number" || isNaN(n)) throw new TypeError(`[LegacyCopelAdapter] Campo inválido: ${field} = ${val}`);
		return n;
	}
	function _parseInputs(raw) {
		return {
			consumo: _requireNumber(raw.consumo, "consumo"),
			cip: _requireNumber(raw.cip, "cip"),
			te_com: _requireNumber(raw.te_com, "te_com"),
			te_sem: _requireNumber(raw.te_sem, "te_sem"),
			tusd_com: _requireNumber(raw.tusd_com, "tusd_com"),
			tus_sem: _requireNumber(raw.tus_sem, "tus_sem"),
			icms_pct: _requireNumber(raw.icms_pct, "icms_pct"),
			cofins_pct: _requireNumber(raw.cofins_pct, "cofins_pct"),
			pis_pct: _requireNumber(raw.pis_pct, "pis_pct"),
			geracao: _requireNumber(raw.geracao, "geracao"),
			uc_prop: _requireNumber(raw.uc_prop, "uc_prop"),
			minimo: _requireNumber(raw.minimo, "minimo"),
			preco_kwh: _requireNumber(raw.preco_kwh, "preco_kwh"),
			desc_dist: _requireNumber(raw.desc_dist, "desc_dist"),
			bndv: _requireNumber(raw.bndv, "bndv")
		};
	}
	function _calcCopelNormal(i) {
		const c_te = i.consumo * (i.te_com + i.bndv);
		const c_tusd = i.consumo * i.tusd_com;
		return {
			c_te,
			c_tusd,
			c_fat: c_te + c_tusd + i.cip
		};
	}
	function _calcCopelTaxes(i, c_te, c_tusd) {
		const c_base_icms = c_te + c_tusd;
		const c_icms = c_base_icms * i.icms_pct;
		const c_base_piscof = c_base_icms - c_icms;
		const c_cofins = c_base_piscof * i.cofins_pct;
		const c_pis = c_base_piscof * i.pis_pct;
		return {
			c_base_icms,
			c_icms,
			c_base_piscof,
			c_cofins,
			c_pis,
			c_imp: c_icms + c_cofins + c_pis
		};
	}
	function _calcGd2Credits(i, c_te, c_tusd) {
		const cred_te = i.consumo * (i.te_sem + i.bndv);
		const cred_tus = i.consumo * i.tus_sem;
		return {
			cred_te,
			cred_tus,
			fio_b: i.consumo * (i.tusd_com - i.tus_sem),
			gd2_te_liq: c_te - cred_te,
			gd2_tus_liq: c_tusd - cred_tus
		};
	}
	function _calcGd2Taxes(i, c_tusd, gd2_tus_liq) {
		const gd2_base_icms = c_tusd;
		const gd2_icms = gd2_base_icms * i.icms_pct;
		const gd2_base_piscof = gd2_tus_liq - gd2_icms;
		const gd2_cofins = gd2_base_piscof * i.cofins_pct;
		const gd2_pis = gd2_base_piscof * i.pis_pct;
		return {
			gd2_base_icms,
			gd2_icms,
			gd2_base_piscof,
			gd2_cofins,
			gd2_pis,
			gd2_imp: gd2_icms + gd2_cofins + gd2_pis
		};
	}
	function _calcCreditSale(i) {
		const cred_disp = Math.max(i.geracao - i.uc_prop - i.minimo, 0);
		const cred_comp_uc = i.consumo;
		const cred_excedente = Math.max(cred_disp - cred_comp_uc, 0);
		const custo_min = i.minimo * (i.te_com + i.bndv) + i.minimo * i.tusd_com + i.cip;
		const rec_bruta = cred_excedente * i.preco_kwh;
		return {
			cred_disp,
			cred_comp_uc,
			cred_excedente,
			custo_min,
			rec_bruta,
			rec_liq: rec_bruta * (1 - i.desc_dist),
			venda_kwh: (i.geracao - i.minimo) * i.preco_kwh,
			custo_min_sc: i.minimo * (i.te_com + i.bndv) + i.minimo * i.tusd_com
		};
	}
	function _calcFinalAndEconomy(c_fat, gd2_tus_liq, venda_kwh, custo_min_sc, cip) {
		const gd2_liq_final = gd2_tus_liq + cip + venda_kwh + custo_min_sc;
		const eco_mensal = c_fat - gd2_liq_final;
		return {
			gd2_liq_final,
			eco_mensal,
			eco_pct: c_fat > 0 ? eco_mensal / c_fat * 100 : 0,
			eco_anual: eco_mensal * 12
		};
	}
	/**
	* Calcula fatura COPEL normal vs ESA GD2.
	* Todos os inputs são obrigatórios e já em unidade base (não %).
	*
	* @param {object} rawInputs
	* @returns {object} memória de cálculo completa (variáveis legacy)
	*/
	function calculate(rawInputs) {
		const i = _parseInputs(rawInputs);
		const { c_te, c_tusd, c_fat } = _calcCopelNormal(i);
		const copelTax = _calcCopelTaxes(i, c_te, c_tusd);
		const { cred_te, cred_tus, fio_b, gd2_te_liq, gd2_tus_liq } = _calcGd2Credits(i, c_te, c_tusd);
		const gd2Tax = _calcGd2Taxes(i, c_tusd, gd2_tus_liq);
		const sale = _calcCreditSale(i);
		const fin = _calcFinalAndEconomy(c_fat, gd2_tus_liq, sale.venda_kwh, sale.custo_min_sc, i.cip);
		return {
			consumo: i.consumo,
			cip: i.cip,
			te_com: i.te_com,
			te_sem: i.te_sem,
			tusd_com: i.tusd_com,
			tus_sem: i.tus_sem,
			icms_pct: i.icms_pct,
			cofins_pct: i.cofins_pct,
			pis_pct: i.pis_pct,
			geracao: i.geracao,
			uc_prop: i.uc_prop,
			minimo: i.minimo,
			preco_kwh: i.preco_kwh,
			desc_dist: i.desc_dist,
			bndv: i.bndv,
			c_te,
			c_tusd,
			c_fat,
			...copelTax,
			cred_te,
			cred_tus,
			fio_b,
			gd2_te_liq,
			gd2_tus_liq,
			...gd2Tax,
			...sale,
			...fin
		};
	}
	//#endregion
	//#region ../../../engines/energy-billing/energy-billing-engine.js
	/**
	* ESA OS — Engines / Energy Billing
	* Billing Engine — orquestra cálculo, snapshot e resultado.
	*
	* NÃO acessa Firebase.
	* NÃO acessa UI.
	* NÃO usa Date.now, Math.random, crypto.randomUUID.
	*/
	var REQUIRED_FIELDS = [
		"consumo",
		"cip",
		"te_com",
		"te_sem",
		"tusd_com",
		"tus_sem",
		"icms_pct",
		"cofins_pct",
		"pis_pct",
		"geracao",
		"uc_prop",
		"minimo",
		"preco_kwh",
		"desc_dist",
		"bndv"
	];
	var EnergyBillingEngine = class {
		/**
		* Calcula o faturamento de um beneficiário.
		*
		* @param {object} input
		* @param {string}  [input.referenceMonth]      - YYYY-MM
		* @param {string}  [input.generatingUnitId]
		* @param {string}  [input.beneficiaryUnitId]
		* @param {object}  input.tariffs               - campos tarifários (te_com, tusd_com, etc.)
		* @param {object}  input.operational            - campos operacionais (consumo, geracao, etc.)
		* @param {object}  [input.settlementRecipient]  - dados PIX/recebedor
		* @param {object}  [input.metadata]
		* @returns {EnergyBillingResult}
		*/
		calculateBeneficiaryBilling(input = {}) {
			const validation = this._validateInput(input);
			if (!validation.ok) return EnergyBillingResult.fail(validation.errors);
			const rawInputs = this._mergeInputs(input);
			let mem;
			try {
				mem = calculate(rawInputs);
			} catch (e) {
				return EnergyBillingResult.fail([EnergyBillingResult.makeError("CALCULATION_FAILED", String(e.message || e))]);
			}
			const snapshot = buildBillingSnapshot({
				referenceMonth: input.referenceMonth || null,
				generatingUnitId: input.generatingUnitId || null,
				beneficiaryUnitId: input.beneficiaryUnitId || null,
				inputs: rawInputs,
				mem,
				settlementRecipient: input.settlementRecipient || null,
				metadata: input.metadata || {}
			});
			return EnergyBillingResult.ok(snapshot, [], { referenceMonth: input.referenceMonth || null });
		}
		/**
		* Constrói o histórico de economia acumulada a partir de uma lista de snapshots mensais.
		*
		* @param {object[]} snapshots - array de billing snapshots ordenados por referenceMonth
		* @returns {object[]} beneficiarySavingsHistory
		*/
		buildSavingsHistory(snapshots = []) {
			if (!Array.isArray(snapshots)) return [];
			let accumulated = 0;
			return snapshots.map((s) => {
				const monthly = s.economiaMensal || 0;
				accumulated += monthly;
				return Object.freeze({
					referenceMonth: s.referenceMonth || null,
					billWithoutEsa: s.contaConcessionaria?.total || null,
					billWithEsa: s.contaEsa?.total || null,
					monthlySavings: monthly,
					savingsPercentage: s.economiaPercentual || 0,
					accumulatedSavings: accumulated
				});
			});
		}
		_validateInput(input) {
			if (!input || typeof input !== "object") return {
				ok: false,
				errors: [EnergyBillingResult.makeError("INVALID_INPUT", "input deve ser objeto")]
			};
			const merged = this._mergeInputs(input);
			const errors = [];
			for (const f of REQUIRED_FIELDS) {
				const v = merged[f];
				const n = typeof v === "string" ? parseCurrency(v) : v;
				if (n === null || n === void 0 || typeof n !== "number" || isNaN(n)) errors.push(EnergyBillingResult.makeError("MISSING_FIELD", `Campo obrigatório inválido: ${f}`, f, v));
			}
			return {
				ok: errors.length === 0,
				errors
			};
		}
		_mergeInputs(input) {
			return Object.assign({}, input.tariffs || {}, input.operational || {}, {
				bndv: input.bndv ?? input.tariffs?.bndv ?? 0,
				desc_dist: input.desc_dist ?? input.tariffs?.desc_dist ?? 0,
				uc_prop: input.uc_prop ?? input.operational?.uc_prop ?? 0
			});
		}
	};
	//#endregion
	//#region ../../../engines/energy-billing/index.js
	var energyBillingEngine = new EnergyBillingEngine();
	//#endregion
	//#region ../../../importers/energy-utility-bills/utility-bill-types.js
	/**
	* ESA OS — Importers / Energy Utility Bills
	* Constantes estáveis de status, fonte, confiança e matching.
	*/
	var UTILITY_BILL_IMPORT_STATUS = Object.freeze({
		EXTRACTED: "extracted",
		MATCHED: "matched",
		UNMATCHED: "unmatched",
		DUPLICATE: "duplicate",
		REVIEW: "review",
		CONFIRMED: "confirmed",
		REPLACED: "replaced",
		DISCARDED: "discarded",
		ERROR: "error"
	});
	var UTILITY_BILL_DATA_SOURCE = Object.freeze({
		UTILITY_BILL_IMPORT: "utility-bill-import",
		CSV: "csv",
		MANUAL: "manual"
	});
	var UTILITY_BILL_CONFIDENCE = Object.freeze({
		HIGH: "high",
		REVIEW: "review",
		UNIDENTIFIED: "unidentified"
	});
	var UTILITY_BILL_MATCH_TYPE = Object.freeze({
		UC_EXACT: "uc-exact",
		DOCUMENT_EXACT: "document-exact",
		MANUAL: "manual",
		NONE: "none"
	});
	var UTILITY_BILL_ERROR_CODE = Object.freeze({
		INVALID_UTILITY_BILL_EXTRACTION: "INVALID_UTILITY_BILL_EXTRACTION",
		UTILITY_BILL_IDENTIFIER_REQUIRED: "UTILITY_BILL_IDENTIFIER_REQUIRED",
		AMBIGUOUS_BENEFICIARY_MATCH: "AMBIGUOUS_BENEFICIARY_MATCH",
		UTILITY_BILL_IMPORT_NOT_FOUND: "UTILITY_BILL_IMPORT_NOT_FOUND",
		UTILITY_BILL_BENEFICIARY_REQUIRED: "UTILITY_BILL_BENEFICIARY_REQUIRED",
		UTILITY_BILL_MONTHLY_RECORD_DUPLICATE: "UTILITY_BILL_MONTHLY_RECORD_DUPLICATE",
		UTILITY_BILL_REPLACEMENT_REASON_REQUIRED: "UTILITY_BILL_REPLACEMENT_REASON_REQUIRED",
		UTILITY_BILL_REPOSITORY_REQUIRED: "UTILITY_BILL_REPOSITORY_REQUIRED",
		UTILITY_BILL_BILLING_INPUT_INCOMPLETE: "UTILITY_BILL_BILLING_INPUT_INCOMPLETE",
		UTILITY_BILL_NOT_MATCHED: "UTILITY_BILL_NOT_MATCHED",
		UTILITY_BILL_GENERATING_UNIT_REQUIRED: "UTILITY_BILL_GENERATING_UNIT_REQUIRED",
		UTILITY_BILL_DUPLICATE_WITHOUT_DECISION: "UTILITY_BILL_DUPLICATE_WITHOUT_DECISION"
	});
	//#endregion
	//#region ../../../importers/energy-utility-bills/utility-bill-result.js
	/**
	* ESA OS — Importers / Energy Utility Bills
	* Contrato de resultado para todas as operações de importação de faturas.
	* Nunca lança exception para erros esperados de negócio.
	*/
	var UtilityBillResult = class {
		static ok(data, warnings = [], metadata = {}) {
			return Object.freeze({
				ok: true,
				data,
				errors: [],
				warnings: Array.isArray(warnings) ? warnings : [],
				metadata: metadata && typeof metadata === "object" ? metadata : {}
			});
		}
		static fail(errors, warnings = [], metadata = {}) {
			const errs = Array.isArray(errors) ? errors : [errors].filter(Boolean);
			return Object.freeze({
				ok: false,
				data: null,
				errors: errs,
				warnings: Array.isArray(warnings) ? warnings : [],
				metadata: metadata && typeof metadata === "object" ? metadata : {}
			});
		}
		static makeError(code, message, field = null, metadata = {}) {
			return Object.freeze({
				code,
				message,
				field,
				metadata: metadata && typeof metadata === "object" ? metadata : {}
			});
		}
		static makeWarning(code, message, field = null, metadata = {}) {
			return Object.freeze({
				code,
				message,
				field,
				metadata: metadata && typeof metadata === "object" ? metadata : {}
			});
		}
	};
	//#endregion
	//#region ../../../importers/energy-utility-bills/utility-bill-extraction-normalizer.js
	/**
	* ESA OS — Importers / Energy Utility Bills
	* UtilityBillExtractionNormalizer
	*
	* Normaliza extrações de fatura já estruturadas (sem OCR real).
	* Sem Date.now(), Math.random(), crypto.randomUUID().
	*/
	var FORBIDDEN_KEYS$1 = /* @__PURE__ */ new Set([
		"password",
		"passHash",
		"sessionToken",
		"sessionExpiresAt",
		"serviceAccount",
		"firebaseConfig",
		"apiKey",
		"secret",
		"stack",
		"stackTrace",
		"internalLog",
		"fileBase64",
		"binary",
		"pdfContent",
		"imageContent"
	]);
	var MONTH_RE$1 = /^\d{4}-(0[1-9]|1[0-2])$/;
	function _str(v) {
		if (v === null || v === void 0) return null;
		if (v instanceof Date) return v.toISOString();
		const s = String(v).trim();
		return s === "" || s === "[object Object]" ? null : s;
	}
	function _parseNum(raw) {
		if (raw === null || raw === void 0 || raw === "") return null;
		if (typeof raw === "number") return isNaN(raw) ? null : raw;
		let s = String(raw).replace(/^R\$\s*/, "").replace(/kWh$/i, "").replace(/\s+/g, "").trim();
		if (!s) return null;
		const dotIdx = s.lastIndexOf(".");
		const commaIdx = s.lastIndexOf(",");
		let normalized;
		if (dotIdx !== -1 && commaIdx !== -1) normalized = dotIdx > commaIdx ? s.replace(/,/g, "") : s.replace(/\./g, "").replace(",", ".");
		else if (commaIdx !== -1) normalized = s.replace(",", ".");
		else if (dotIdx !== -1) normalized = s.slice(dotIdx + 1).length === 3 ? s.replace(/\./g, "") : s;
		else normalized = s;
		const n = Number(normalized);
		return isNaN(n) ? null : n;
	}
	function _normalizeMonth(raw) {
		if (!raw) return null;
		const s = String(raw).trim();
		if (MONTH_RE$1.test(s)) return s;
		if (/^\d{1,2}\/\d{4}$/.test(s)) {
			const [m, y] = s.split("/");
			return `${y}-${m.padStart(2, "0")}`;
		}
		if (/^\d{4}\/\d{1,2}$/.test(s)) {
			const [y, m] = s.split("/");
			return `${y}-${m.padStart(2, "0")}`;
		}
		return null;
	}
	function _normalizeUc$1(raw) {
		if (!raw) return null;
		return String(raw).trim().replace(/[\s\-\.\/]/g, "").toUpperCase();
	}
	function _normalizeDocDigits(raw) {
		if (!raw) return null;
		const digits = String(raw).replace(/\D/g, "");
		return digits.length > 0 ? digits : null;
	}
	function _normSafe(v) {
		if (v === void 0 || v === null) return null;
		if (v instanceof Date) return v.toISOString();
		if (typeof v === "number") return isNaN(v) ? null : v;
		if (typeof v === "string") {
			const t = v.trim();
			return t === "" || t === "[object Object]" ? null : t;
		}
		if (Array.isArray(v)) return v.map(_normSafe);
		if (typeof v === "object") {
			const out = {};
			for (const [k, val] of Object.entries(v)) if (!FORBIDDEN_KEYS$1.has(k)) out[k] = _normSafe(val);
			return out;
		}
		return v;
	}
	function _normalizeComponents(raw) {
		if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
		return {
			te: _parseNum(raw.te) ?? null,
			tusd: _parseNum(raw.tusd) ?? null,
			fioB: _parseNum(raw.fioB) ?? null,
			bandeira: _parseNum(raw.bandeira) ?? null,
			cip: _parseNum(raw.cip) ?? null,
			taxes: _parseNum(raw.taxes) ?? null,
			otherCharges: _parseNum(raw.otherCharges) ?? null
		};
	}
	function _slugPart(raw) {
		if (!raw) return null;
		return String(raw).trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
	}
	function _generateId(utilityCompany, uc, referenceMonth) {
		const p1 = _slugPart(utilityCompany);
		const p2 = _slugPart(uc ? String(uc).toLowerCase() : null);
		const p3 = _slugPart(referenceMonth);
		if (!p1 || !p2 || !p3) return null;
		return `utility-bill-${p1}-${p2}-${p3}`;
	}
	var UtilityBillExtractionNormalizer = class {
		normalize(raw) {
			if (!raw || typeof raw !== "object" || Array.isArray(raw)) return UtilityBillResult.fail([UtilityBillResult.makeError(UTILITY_BILL_ERROR_CODE.INVALID_UTILITY_BILL_EXTRACTION, "Extraction deve ser um objeto")]);
			return UtilityBillResult.ok(this._build(raw));
		}
		_build(raw) {
			const uc = _normalizeUc$1(raw.uc);
			const referenceMonth = _normalizeMonth(raw.referenceMonth);
			const utilityCompany = _str(raw.utilityCompany);
			return {
				id: _str(raw.id) || _generateId(utilityCompany, uc, referenceMonth),
				extractionSource: _str(raw.extractionSource),
				fileName: _str(raw.fileName),
				mimeType: _str(raw.mimeType),
				referenceMonth,
				uc,
				ucOriginal: _str(raw.uc),
				customerName: _str(raw.customerName),
				customerDocument: _str(raw.customerDocument),
				customerDocumentDigits: _normalizeDocDigits(raw.customerDocument),
				utilityCompany,
				monthlyConsumptionKwh: _parseNum(raw.monthlyConsumptionKwh) ?? null,
				components: _normalizeComponents(raw.components),
				minimumBillableKwh: _parseNum(raw.minimumBillableKwh) ?? null,
				totalUtilityBillAmount: _parseNum(raw.totalUtilityBillAmount) ?? null,
				confidence: _str(raw.confidence),
				extractedAt: _str(raw.extractedAt),
				metadata: _normSafe(raw.metadata) || {}
			};
		}
	};
	//#endregion
	//#region ../../../importers/energy-utility-bills/utility-bill-validator.js
	/**
	* ESA OS — Importers / Energy Utility Bills
	* UtilityBillValidator
	*
	* Valida a extração normalizada. Retorna erros estruturados e warnings.
	* Não lança exception para erros esperados de importação.
	*/
	var MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
	function _err(code, message, field, value = null) {
		return UtilityBillResult.makeError(code, message, field, value !== null ? { value } : {});
	}
	function _warn(code, message, field) {
		return UtilityBillResult.makeWarning(code, message, field);
	}
	function _isNonNegNum(v) {
		return v === null || v === void 0 || typeof v === "number" && !isNaN(v) && v >= 0;
	}
	function _validateComponents(components, errors) {
		if (!components || typeof components !== "object") return;
		for (const f of [
			"te",
			"tusd",
			"fioB",
			"bandeira",
			"cip",
			"taxes",
			"otherCharges"
		]) {
			const v = components[f];
			if (v !== null && v !== void 0 && (typeof v !== "number" || isNaN(v) || v < 0)) errors.push(_err("INVALID_COMPONENT", `Componente ${f} inválido: deve ser >= 0`, `components.${f}`, v));
		}
	}
	function _validateId(normalized, errors) {
		if (normalized.id) return;
		errors.push(_err(UTILITY_BILL_ERROR_CODE.UTILITY_BILL_IDENTIFIER_REQUIRED, "Não foi possível gerar id determinístico: uc, referenceMonth e utilityCompany são necessários", "id"));
	}
	function _validateMonth(normalized, errors) {
		if (!normalized.referenceMonth) {
			errors.push(_err("INVALID_REFERENCE_MONTH", "referenceMonth é obrigatório (YYYY-MM)", "referenceMonth"));
			return;
		}
		if (!MONTH_RE.test(normalized.referenceMonth)) errors.push(_err("INVALID_REFERENCE_MONTH", `referenceMonth inválido: "${normalized.referenceMonth}"`, "referenceMonth", normalized.referenceMonth));
	}
	function _validateUc(normalized, errors) {
		if (!normalized.uc) errors.push(_err("UTILITY_BILL_UC_REQUIRED", "uc é obrigatório", "uc"));
	}
	function _validateNumericFields(normalized, errors) {
		const { monthlyConsumptionKwh, minimumBillableKwh, totalUtilityBillAmount } = normalized;
		if (!_isNonNegNum(monthlyConsumptionKwh)) errors.push(_err("INVALID_CONSUMPTION", "monthlyConsumptionKwh deve ser >= 0", "monthlyConsumptionKwh", monthlyConsumptionKwh));
		if (!_isNonNegNum(minimumBillableKwh)) errors.push(_err("INVALID_MINIMUM_BILLABLE", "minimumBillableKwh deve ser >= 0", "minimumBillableKwh", minimumBillableKwh));
		if (!_isNonNegNum(totalUtilityBillAmount)) errors.push(_err("INVALID_TOTAL_AMOUNT", "totalUtilityBillAmount deve ser >= 0", "totalUtilityBillAmount", totalUtilityBillAmount));
	}
	function _validateUtilityCompany(normalized, warnings) {
		if (!normalized.utilityCompany) warnings.push(_warn("UTILITY_COMPANY_MISSING", "utilityCompany ausente: matching por UC pode ser impreciso", "utilityCompany"));
	}
	var UtilityBillValidator = class {
		validate(normalized) {
			if (!normalized || typeof normalized !== "object") return UtilityBillResult.fail([_err(UTILITY_BILL_ERROR_CODE.INVALID_UTILITY_BILL_EXTRACTION, "Extraction normalizada é obrigatória", null)]);
			const errors = [];
			const warnings = [];
			_validateId(normalized, errors);
			_validateMonth(normalized, errors);
			_validateUc(normalized, errors);
			_validateNumericFields(normalized, errors);
			_validateComponents(normalized.components, errors);
			_validateUtilityCompany(normalized, warnings);
			return errors.length > 0 ? UtilityBillResult.fail(errors, warnings) : UtilityBillResult.ok(normalized, warnings);
		}
	};
	//#endregion
	//#region ../../../importers/energy-utility-bills/utility-bill-matcher.js
	/**
	* ESA OS — Importers / Energy Utility Bills
	* UtilityBillMatcher
	*
	* Faz matching de extração contra lista de UC beneficiárias.
	* Prioridade: UC exata > CPF/CNPJ exato.
	* Ambiguidade explicitada — nunca escolhida silenciosamente.
	* Não cria beneficiária.
	*/
	function _normalizeUc(raw) {
		if (!raw) return null;
		return String(raw).trim().replace(/[\s\-\.\/]/g, "").toUpperCase();
	}
	function _normalizeDoc(raw) {
		if (!raw) return null;
		const digits = String(raw).replace(/\D/g, "");
		return digits.length > 0 ? digits : null;
	}
	function _unitNormalizedUc(unit) {
		return _normalizeUc(unit.uc);
	}
	function _unitNormalizedDoc(unit) {
		return _normalizeDoc(unit.holderDocument || unit.holderCpfCnpj || unit.document || unit.cpfCnpj);
	}
	function _findByUc(units, extractionUc) {
		if (!extractionUc) return [];
		return units.filter((u) => _unitNormalizedUc(u) === extractionUc);
	}
	function _findByDoc(units, extractionDoc) {
		if (!extractionDoc) return [];
		return units.filter((u) => {
			const d = _unitNormalizedDoc(u);
			return d && d === extractionDoc;
		});
	}
	function _buildMatchResult(matched, matchType, unit, candidates, meta = {}) {
		return {
			matched,
			matchType,
			beneficiaryUnit: unit,
			candidates,
			metadata: meta
		};
	}
	function _ambiguousResult(candidates, matchType) {
		return UtilityBillResult.fail([UtilityBillResult.makeError(UTILITY_BILL_ERROR_CODE.AMBIGUOUS_BENEFICIARY_MATCH, `Mais de uma beneficiária encontrada para ${matchType}: ${candidates.map((u) => u.id).join(", ")}`, matchType, { candidateIds: candidates.map((u) => u.id) })], [], { candidates });
	}
	function _unmatchedResult(extractionUc, extractionDoc) {
		return UtilityBillResult.ok(_buildMatchResult(false, UTILITY_BILL_MATCH_TYPE.NONE, null, [], {
			extractionUc,
			extractionDoc
		}), [], { status: "unmatched" });
	}
	var UtilityBillMatcher = class {
		match(extraction, beneficiaryUnits) {
			if (!extraction || typeof extraction !== "object") return UtilityBillResult.fail([UtilityBillResult.makeError(UTILITY_BILL_ERROR_CODE.INVALID_UTILITY_BILL_EXTRACTION, "Extraction é obrigatória", null)]);
			const units = Array.isArray(beneficiaryUnits) ? beneficiaryUnits : [];
			const extractionUc = extraction.uc || _normalizeUc(extraction.ucOriginal);
			const extractionDoc = extraction.customerDocumentDigits || _normalizeDoc(extraction.customerDocument);
			return this._runMatch(units, extractionUc, extractionDoc);
		}
		_runMatch(units, extractionUc, extractionDoc) {
			const byUc = _findByUc(units, extractionUc);
			if (byUc.length === 1) return UtilityBillResult.ok(_buildMatchResult(true, UTILITY_BILL_MATCH_TYPE.UC_EXACT, byUc[0], byUc));
			if (byUc.length > 1) return _ambiguousResult(byUc, "uc-exact");
			const byDoc = _findByDoc(units, extractionDoc);
			if (byDoc.length === 1) return UtilityBillResult.ok(_buildMatchResult(true, UTILITY_BILL_MATCH_TYPE.DOCUMENT_EXACT, byDoc[0], byDoc));
			if (byDoc.length > 1) return _ambiguousResult(byDoc, "document-exact");
			return _unmatchedResult(extractionUc, extractionDoc);
		}
	};
	//#endregion
	//#region ../../../importers/energy-utility-bills/utility-bill-duplicate-detector.js
	/**
	* ESA OS — Importers / Energy Utility Bills
	* UtilityBillDuplicateDetector
	*
	* Detecta duplicidade por beneficiaryUnitId + referenceMonth.
	* Compara campos financeiros e operacionais quando disponíveis.
	* Comparações ordenadas deterministicamente.
	*/
	var COMPARISON_FIELDS = Object.freeze([
		"monthlyConsumptionKwh",
		"te",
		"tusd",
		"fioB",
		"bandeira",
		"cip",
		"taxes",
		"minimumBillableKwh",
		"totalUtilityBillAmount"
	]);
	function _extractFieldValue(record, field) {
		if (field === "monthlyConsumptionKwh") return record.monthlyConsumptionKwh ?? null;
		if (field === "minimumBillableKwh") return record.utilityBillData?.minimumBillableKwh ?? null;
		if (field === "totalUtilityBillAmount") return record.utilityBillData?.totalUtilityBillAmount ?? null;
		return record.utilityBillData?.components?.[field] ?? null;
	}
	function _extractIncomingValue(extraction, field) {
		if (field === "monthlyConsumptionKwh") return extraction?.monthlyConsumptionKwh ?? null;
		if (field === "minimumBillableKwh") return extraction?.minimumBillableKwh ?? null;
		if (field === "totalUtilityBillAmount") return extraction?.totalUtilityBillAmount ?? null;
		return extraction?.components?.[field] ?? null;
	}
	function _buildComparison(existingRecord, extraction) {
		return COMPARISON_FIELDS.map((field) => {
			const currentValue = _extractFieldValue(existingRecord, field);
			const incomingValue = _extractIncomingValue(extraction, field);
			return Object.freeze({
				field,
				currentValue,
				incomingValue,
				changed: currentValue !== incomingValue && !(currentValue === null && incomingValue === null)
			});
		});
	}
	function _findDuplicate(beneficiaryUnitId, referenceMonth, existingMonthlyRecords) {
		for (const rec of existingMonthlyRecords) if (rec.beneficiaryUnitId === beneficiaryUnitId && rec.referenceMonth === referenceMonth) return rec;
		return null;
	}
	var UtilityBillDuplicateDetector = class {
		detect(beneficiaryUnitId, referenceMonth, existingMonthlyRecords, extraction = null) {
			if (!beneficiaryUnitId || !referenceMonth) return UtilityBillResult.fail([UtilityBillResult.makeError("REQUIRED", "beneficiaryUnitId e referenceMonth são obrigatórios", null)]);
			const existing = _findDuplicate(beneficiaryUnitId, referenceMonth, Array.isArray(existingMonthlyRecords) ? existingMonthlyRecords : []);
			const comparison = existing ? _buildComparison(existing, extraction) : [];
			return UtilityBillResult.ok({
				duplicate: existing !== null,
				existingRecord: existing ?? null,
				comparison
			});
		}
	};
	//#endregion
	//#region ../../../importers/energy-utility-bills/utility-bill-billing-input-adapter.js
	/**
	* ESA OS — Importers / Energy Utility Bills
	* buildBillingInputFromUtilityBillMonthlyRecord
	*
	* Monta input para o EnergyBillingEngine a partir de um registro mensal de fatura.
	* NÃO executa cálculo. NÃO inventa tarifa. NÃO assume defaults silenciosos.
	* Campos não disponíveis na fatura devem ser fornecidos via context.
	*/
	var REQUIRED_TARIFF_FIELDS = [
		"te_com",
		"te_sem",
		"tusd_com",
		"tus_sem",
		"icms_pct",
		"cofins_pct",
		"pis_pct"
	];
	var REQUIRED_OPERATIONAL_FIELDS = [
		"consumo",
		"cip",
		"geracao",
		"uc_prop",
		"minimo",
		"preco_kwh",
		"desc_dist",
		"bndv"
	];
	function _isValidNum(v) {
		return typeof v === "number" && !isNaN(v);
	}
	function _extractFromRecord(monthlyRecord) {
		const comp = monthlyRecord?.utilityBillData?.components;
		return {
			consumo: monthlyRecord?.monthlyConsumptionKwh ?? null,
			cip: comp?.cip ?? null,
			minimo: monthlyRecord?.utilityBillData?.minimumBillableKwh ?? null
		};
	}
	function _mergeOperational(fromRecord, contextOperational) {
		return Object.assign({}, fromRecord, contextOperational || {});
	}
	function _findMissingFields(merged, contextTariffs) {
		const allFields = {
			...contextTariffs,
			...merged
		};
		const missing = [];
		for (const f of REQUIRED_TARIFF_FIELDS) if (!_isValidNum(Number(allFields[f]))) missing.push(f);
		for (const f of REQUIRED_OPERATIONAL_FIELDS) if (!_isValidNum(Number(allFields[f]))) missing.push(f);
		return missing;
	}
	function _buildMissingErrors(missingFields) {
		return missingFields.map((f) => UtilityBillResult.makeError(UTILITY_BILL_ERROR_CODE.UTILITY_BILL_BILLING_INPUT_INCOMPLETE, `Campo obrigatório ausente para o Billing Engine: ${f}`, f));
	}
	function _buildInput(monthlyRecord, tariffs, operational) {
		return {
			referenceMonth: monthlyRecord.referenceMonth || null,
			beneficiaryUnitId: monthlyRecord.beneficiaryUnitId || null,
			generatingUnitId: monthlyRecord.generatingUnitId || null,
			tariffs: { ...tariffs },
			operational: { ...operational }
		};
	}
	function buildBillingInputFromUtilityBillMonthlyRecord(monthlyRecord, context = {}) {
		if (!monthlyRecord || typeof monthlyRecord !== "object") return UtilityBillResult.fail([UtilityBillResult.makeError(UTILITY_BILL_ERROR_CODE.INVALID_UTILITY_BILL_EXTRACTION, "monthlyRecord é obrigatório", null)]);
		const tariffs = context.tariffs || {};
		const contextOperational = context.operational || {};
		const operational = _mergeOperational(_extractFromRecord(monthlyRecord), contextOperational);
		const missing = _findMissingFields(operational, tariffs);
		if (missing.length > 0) return UtilityBillResult.fail(_buildMissingErrors(missing), [], { missingFields: missing });
		return UtilityBillResult.ok(_buildInput(monthlyRecord, tariffs, operational));
	}
	//#endregion
	//#region ../../../importers/energy-utility-bills/utility-bill-import-service.js
	/**
	* ESA OS — Importers / Energy Utility Bills
	* UtilityBillImportService
	*
	* Orquestra o fluxo completo de importação de fatura da distribuidora.
	* Mantém estado interno em memória (_imports Map).
	* NÃO cria beneficiária automaticamente.
	* NÃO gera Fatura ESA automaticamente.
	* NÃO persiste em Firebase por padrão.
	* NÃO usa Date.now(), Math.random(), crypto.randomUUID().
	*/
	function _notFound(id) {
		return UtilityBillResult.fail([UtilityBillResult.makeError(UTILITY_BILL_ERROR_CODE.UTILITY_BILL_IMPORT_NOT_FOUND, `Import não encontrado: ${id}`, "id")]);
	}
	function _effectiveData(record) {
		if (!record.correctedData) return record.extraction;
		return Object.assign({}, record.extraction, record.correctedData);
	}
	function _initialStatus(confidence) {
		return confidence === UTILITY_BILL_CONFIDENCE.REVIEW || confidence === UTILITY_BILL_CONFIDENCE.UNIDENTIFIED ? UTILITY_BILL_IMPORT_STATUS.REVIEW : UTILITY_BILL_IMPORT_STATUS.EXTRACTED;
	}
	function _buildRecord(extraction, options = {}) {
		return {
			id: extraction.id,
			status: _initialStatus(extraction.confidence),
			extraction,
			match: null,
			duplicate: null,
			correctedData: null,
			beneficiaryUnitId: null,
			generatingUnitId: null,
			referenceMonth: extraction.referenceMonth,
			dataSource: UTILITY_BILL_DATA_SOURCE.UTILITY_BILL_IMPORT,
			sourceFileName: extraction.fileName,
			confirmedAt: null,
			confirmedBy: null,
			replacedAt: null,
			replacementReason: null,
			metadata: options.metadata || {}
		};
	}
	function _persistRecord(record, repository) {
		if (!repository || typeof repository.saveUtilityBillImport !== "function") return UtilityBillResult.fail([UtilityBillResult.makeError(UTILITY_BILL_ERROR_CODE.UTILITY_BILL_REPOSITORY_REQUIRED, "Repository com saveUtilityBillImport é obrigatório quando persist=true", "repository")]);
		return repository.saveUtilityBillImport(record);
	}
	function _buildMonthlyRecordId(beneficiaryUnitId, referenceMonth) {
		return `ubm-${beneficiaryUnitId}-${referenceMonth}`;
	}
	function _buildMonthlyRecord(importRecord, data, options = {}) {
		const bid = importRecord.beneficiaryUnitId;
		const gid = importRecord.generatingUnitId;
		const month = importRecord.referenceMonth || data?.referenceMonth;
		return {
			id: _buildMonthlyRecordId(bid, month),
			beneficiaryUnitId: bid,
			generatingUnitId: gid,
			referenceMonth: month,
			monthlyConsumptionKwh: data?.monthlyConsumptionKwh ?? null,
			dataSource: UTILITY_BILL_DATA_SOURCE.UTILITY_BILL_IMPORT,
			sourceImportId: importRecord.id,
			sourceFileName: importRecord.sourceFileName,
			utilityBillData: {
				uc: data?.uc ?? null,
				utilityCompany: data?.utilityCompany ?? null,
				components: data?.components ?? null,
				minimumBillableKwh: data?.minimumBillableKwh ?? null,
				totalUtilityBillAmount: data?.totalUtilityBillAmount ?? null
			},
			status: "review"
		};
	}
	function _persistMonthlyRecord(monthlyRecord, options) {
		if (!options.persistMonthlyRecord) return null;
		if (!options.repository || typeof options.repository.saveBeneficiaryMonthlyRecord !== "function") return UtilityBillResult.fail([UtilityBillResult.makeError(UTILITY_BILL_ERROR_CODE.UTILITY_BILL_REPOSITORY_REQUIRED, "Repository com saveBeneficiaryMonthlyRecord é obrigatório quando persistMonthlyRecord=true", "repository")]);
		return options.repository.saveBeneficiaryMonthlyRecord(monthlyRecord);
	}
	function _checkConfirmPreconditions(record) {
		if (record.status === UTILITY_BILL_IMPORT_STATUS.DISCARDED) return UtilityBillResult.makeError("UTILITY_BILL_DISCARDED", "Import descartado não pode ser confirmado", "status");
		if (!record.beneficiaryUnitId) return UtilityBillResult.makeError(UTILITY_BILL_ERROR_CODE.UTILITY_BILL_BENEFICIARY_REQUIRED, "beneficiaryUnitId é obrigatório", "beneficiaryUnitId");
		if (!record.generatingUnitId) return UtilityBillResult.makeError(UTILITY_BILL_ERROR_CODE.UTILITY_BILL_GENERATING_UNIT_REQUIRED, "generatingUnitId é obrigatório", "generatingUnitId");
		if (record.duplicate?.duplicate && !record._allowDuplicate) return UtilityBillResult.makeError(UTILITY_BILL_ERROR_CODE.UTILITY_BILL_MONTHLY_RECORD_DUPLICATE, "Duplicidade detectada. Use replaceMonthlyRecord ou defina allowDuplicate.", "duplicate");
		return null;
	}
	function _applyFilters$1(records, filters) {
		let result = records;
		if (filters.status != null) result = result.filter((r) => r.status === filters.status);
		if (filters.referenceMonth != null) result = result.filter((r) => r.referenceMonth === filters.referenceMonth);
		if (filters.uc != null) result = result.filter((r) => r.extraction?.uc === filters.uc);
		if (filters.beneficiaryUnitId != null) result = result.filter((r) => r.beneficiaryUnitId === filters.beneficiaryUnitId);
		if (filters.utilityCompany != null) result = result.filter((r) => r.extraction?.utilityCompany === filters.utilityCompany);
		if (filters.confidence != null) result = result.filter((r) => r.extraction?.confidence === filters.confidence);
		return result;
	}
	var UtilityBillImportService = class {
		constructor() {
			this._imports = /* @__PURE__ */ new Map();
			this._normalizer = new UtilityBillExtractionNormalizer();
			this._validator = new UtilityBillValidator();
			this._matcher = new UtilityBillMatcher();
			this._dupDetector = new UtilityBillDuplicateDetector();
		}
		createImport(rawExtraction, options = {}) {
			const normResult = this._normalizer.normalize(rawExtraction);
			if (!normResult.ok) return normResult;
			const validResult = this._validator.validate(normResult.data);
			if (!validResult.ok) return validResult;
			const extraction = normResult.data;
			const record = _buildRecord(extraction, options);
			this._imports.set(record.id, record);
			if (options.persist) {
				const persisted = _persistRecord(record, options.repository);
				if (persisted && !persisted.ok) return persisted;
			}
			return UtilityBillResult.ok(record, validResult.warnings);
		}
		matchImport(importId, beneficiaryUnits, options = {}) {
			const record = this._imports.get(importId);
			if (!record) return _notFound(importId);
			const matchResult = this._matcher.match(record.extraction, beneficiaryUnits);
			if (!matchResult.ok) {
				const updated = Object.assign({}, record, {
					status: UTILITY_BILL_IMPORT_STATUS.REVIEW,
					match: {
						matched: false,
						matchType: UTILITY_BILL_MATCH_TYPE.NONE,
						beneficiaryUnit: null,
						candidates: matchResult.metadata?.candidates || [],
						metadata: { ambiguous: true }
					}
				});
				this._imports.set(importId, updated);
				return matchResult;
			}
			const matched = matchResult.data.matched;
			const matchData = matchResult.data;
			const updated = Object.assign({}, record, {
				status: matched ? UTILITY_BILL_IMPORT_STATUS.MATCHED : UTILITY_BILL_IMPORT_STATUS.UNMATCHED,
				match: matchData,
				beneficiaryUnitId: matchData.beneficiaryUnit?.id || null,
				generatingUnitId: matchData.beneficiaryUnit?.generatingUnitId || null
			});
			this._imports.set(importId, updated);
			if (options.persist) _persistRecord(updated, options.repository);
			return UtilityBillResult.ok(updated);
		}
		linkImportToBeneficiary(importId, beneficiaryUnitId, context = {}) {
			const record = this._imports.get(importId);
			if (!record) return _notFound(importId);
			if (!beneficiaryUnitId) return UtilityBillResult.fail([UtilityBillResult.makeError(UTILITY_BILL_ERROR_CODE.UTILITY_BILL_BENEFICIARY_REQUIRED, "beneficiaryUnitId é obrigatório", "beneficiaryUnitId")]);
			const unit = (Array.isArray(context.beneficiaryUnits) ? context.beneficiaryUnits : []).find((u) => u.id === beneficiaryUnitId) || null;
			const updated = Object.assign({}, record, {
				status: UTILITY_BILL_IMPORT_STATUS.MATCHED,
				match: {
					matched: true,
					matchType: UTILITY_BILL_MATCH_TYPE.MANUAL,
					beneficiaryUnit: unit,
					candidates: unit ? [unit] : [],
					metadata: { manualLink: true }
				},
				beneficiaryUnitId,
				generatingUnitId: unit?.generatingUnitId || null
			});
			this._imports.set(importId, updated);
			return UtilityBillResult.ok(updated);
		}
		prepareBeneficiaryFromImport(importId) {
			const record = this._imports.get(importId);
			if (!record) return _notFound(importId);
			const data = _effectiveData(record);
			return UtilityBillResult.ok({
				name: data?.customerName ?? null,
				document: data?.customerDocument ?? null,
				uc: data?.uc ?? null,
				utilityCompany: data?.utilityCompany ?? null
			});
		}
		reviewImport(importId, correctedData, options = {}) {
			const record = this._imports.get(importId);
			if (!record) return _notFound(importId);
			const merged = Object.assign({}, _effectiveData(record), correctedData || {});
			const normResult = this._normalizer.normalize(merged);
			if (!normResult.ok) return normResult;
			const validResult = this._validator.validate(normResult.data);
			if (!validResult.ok) return validResult;
			const updated = Object.assign({}, record, {
				status: UTILITY_BILL_IMPORT_STATUS.REVIEW,
				correctedData: normResult.data
			});
			this._imports.set(importId, updated);
			return UtilityBillResult.ok(updated, validResult.warnings);
		}
		detectDuplicate(importId, existingMonthlyRecords, options = {}) {
			const record = this._imports.get(importId);
			if (!record) return _notFound(importId);
			const data = _effectiveData(record);
			const result = this._dupDetector.detect(record.beneficiaryUnitId, record.referenceMonth || data?.referenceMonth, existingMonthlyRecords, data);
			if (!result.ok) return result;
			const isDup = result.data.duplicate;
			const updated = Object.assign({}, record, {
				duplicate: result.data,
				status: isDup ? UTILITY_BILL_IMPORT_STATUS.DUPLICATE : record.status
			});
			this._imports.set(importId, updated);
			return UtilityBillResult.ok(updated);
		}
		confirmMonthlyRecord(importId, options = {}) {
			const record = this._imports.get(importId);
			if (!record) return _notFound(importId);
			const precondErr = _checkConfirmPreconditions(options.allowDuplicate ? Object.assign({}, record, { _allowDuplicate: true }) : record);
			if (precondErr) return UtilityBillResult.fail([precondErr]);
			const monthlyRecord = _buildMonthlyRecord(record, _effectiveData(record), options);
			const persistErr = _persistMonthlyRecord(monthlyRecord, options);
			if (persistErr && !persistErr.ok) return persistErr;
			const updated = Object.assign({}, record, {
				status: UTILITY_BILL_IMPORT_STATUS.CONFIRMED,
				confirmedAt: options.referenceDate || null,
				confirmedBy: options.confirmedBy || null
			});
			delete updated._allowDuplicate;
			this._imports.set(importId, updated);
			return UtilityBillResult.ok({
				importRecord: updated,
				monthlyRecord
			});
		}
		replaceMonthlyRecord(importId, replacementReason, options = {}) {
			if (!replacementReason) return UtilityBillResult.fail([UtilityBillResult.makeError(UTILITY_BILL_ERROR_CODE.UTILITY_BILL_REPLACEMENT_REASON_REQUIRED, "replacementReason é obrigatório", "replacementReason")]);
			const record = this._imports.get(importId);
			if (!record) return _notFound(importId);
			if (!record.beneficiaryUnitId) return UtilityBillResult.fail([UtilityBillResult.makeError(UTILITY_BILL_ERROR_CODE.UTILITY_BILL_NOT_MATCHED, "Import deve estar matched para substituição", "status")]);
			const monthlyRecord = _buildMonthlyRecord(record, _effectiveData(record), options);
			const persistErr = _persistMonthlyRecord(monthlyRecord, options);
			if (persistErr && !persistErr.ok) return persistErr;
			const updated = Object.assign({}, record, {
				status: UTILITY_BILL_IMPORT_STATUS.REPLACED,
				replacementReason,
				replacedAt: options.referenceDate || null
			});
			this._imports.set(importId, updated);
			return UtilityBillResult.ok({
				importRecord: updated,
				monthlyRecord
			});
		}
		discardImport(importId, options = {}) {
			const record = this._imports.get(importId);
			if (!record) return _notFound(importId);
			const updated = Object.assign({}, record, { status: UTILITY_BILL_IMPORT_STATUS.DISCARDED });
			this._imports.set(importId, updated);
			return UtilityBillResult.ok(updated);
		}
		listUnlinkedUtilityBills(filters = {}) {
			const all = Array.from(this._imports.values()).filter((r) => r.status === UTILITY_BILL_IMPORT_STATUS.UNMATCHED);
			return UtilityBillResult.ok(_applyFilters$1(all, filters), [], { count: all.length });
		}
		getImport(importId) {
			const record = this._imports.get(importId);
			return record ? UtilityBillResult.ok(record) : _notFound(importId);
		}
		listImports(filters = {}) {
			const filtered = _applyFilters$1(Array.from(this._imports.values()), filters).sort((a, b) => (a.id || "").localeCompare(b.id || ""));
			return UtilityBillResult.ok(filtered, [], { count: filtered.length });
		}
	};
	//#endregion
	//#region ../../../queries/energy-utility-bills/utility-bill-query-service.js
	/**
	* ESA OS — Queries / Energy Utility Bills
	* UtilityBillQueryService
	*
	* Arquitetura: query service específico para workflow de ingestão de faturas.
	* Razão: separar o workflow de ingestão do EnergyCreditsQueryService evita
	* poluição de responsabilidades — faturas da distribuidora são dados externos
	* que passam por um fluxo de review antes de se tornarem dados operacionais.
	*
	* Lê diretamente do UtilityBillImportService (fonte de verdade em memória).
	* Sem Firebase. Sem efeitos colaterais. Sem estado próprio.
	*/
	function _applyFilters(records, filters) {
		let result = records;
		if (filters.status != null) result = result.filter((r) => r.status === filters.status);
		if (filters.referenceMonth != null) result = result.filter((r) => r.referenceMonth === filters.referenceMonth);
		if (filters.uc != null) result = result.filter((r) => r.extraction?.uc === filters.uc);
		if (filters.beneficiaryUnitId != null) result = result.filter((r) => r.beneficiaryUnitId === filters.beneficiaryUnitId);
		if (filters.utilityCompany != null) result = result.filter((r) => r.extraction?.utilityCompany === filters.utilityCompany);
		if (filters.confidence != null) result = result.filter((r) => r.extraction?.confidence === filters.confidence);
		return result;
	}
	function _sortById(records) {
		return [...records].sort((a, b) => (a.id || "").localeCompare(b.id || ""));
	}
	function _buildDataSourceEntry(importRecord) {
		return {
			importId: importRecord.id,
			status: importRecord.status,
			dataSource: importRecord.dataSource,
			sourceFileName: importRecord.sourceFileName,
			referenceMonth: importRecord.referenceMonth,
			beneficiaryUnitId: importRecord.beneficiaryUnitId,
			confidence: importRecord.extraction?.confidence ?? null,
			matched: importRecord.match?.matched ?? false,
			matchType: importRecord.match?.matchType ?? null,
			duplicate: importRecord.duplicate?.duplicate ?? false,
			confirmedAt: importRecord.confirmedAt,
			confirmedBy: importRecord.confirmedBy
		};
	}
	var UtilityBillQueryService = class {
		constructor(importService) {
			this._svc = importService || null;
		}
		_requireService(method) {
			if (!this._svc || typeof this._svc.listImports !== "function") throw new TypeError(`[UtilityBillQueryService.${method}] importService inválido`);
		}
		getUtilityBillImport(id) {
			this._requireService("getUtilityBillImport");
			return this._svc.getImport(id);
		}
		searchUtilityBillImports(filters = {}) {
			this._requireService("searchUtilityBillImports");
			const listResult = this._svc.listImports(filters);
			if (!listResult.ok) return listResult;
			const sorted = _sortById(_applyFilters(listResult.data, {}));
			return UtilityBillResult.ok(sorted, [], {
				count: sorted.length,
				filters
			});
		}
		getUnlinkedUtilityBills(filters = {}) {
			this._requireService("getUnlinkedUtilityBills");
			const listResult = this._svc.listImports({
				...filters,
				status: UTILITY_BILL_IMPORT_STATUS.UNMATCHED
			});
			if (!listResult.ok) return listResult;
			const sorted = _sortById(listResult.data);
			return UtilityBillResult.ok(sorted, [], { count: sorted.length });
		}
		getBeneficiaryMonthlyDataSources(beneficiaryUnitId, filters = {}) {
			this._requireService("getBeneficiaryMonthlyDataSources");
			const listResult = this._svc.listImports({
				...filters,
				beneficiaryUnitId
			});
			if (!listResult.ok) return listResult;
			const sorted = _sortById(listResult.data).map(_buildDataSourceEntry);
			return UtilityBillResult.ok(sorted, [], {
				count: sorted.length,
				beneficiaryUnitId
			});
		}
	};
	//#endregion
	//#region ../../../importers/energy-credits/csv-template-service.js
	/**
	* ESA OS — Importers / Energy Credits
	* EnergyCreditsCsvTemplateService
	*
	* Gera templates CSV para importação de créditos ESA Energia.
	* Headers baseados nos aliases reais do EnergyCreditsImportMapper.
	* Delimiter padrão: ";" (compatível com autodetect do CsvParser).
	*/
	var DELIMITER = ";";
	var TEMPLATES = {
		"generating-units": {
			headers: [
				"id",
				"name",
				"ownerName",
				"ownerDocument",
				"uc",
				"utilityCompany",
				"status"
			],
			exampleRows: [[
				"gu-001",
				"Usina Solar Norte",
				"João Silva",
				"123.456.789-00",
				"UC001",
				"COPEL",
				"active"
			]],
			aliases: {
				id: [
					"id",
					"codigo",
					"código"
				],
				name: ["name", "nome"],
				ownerName: [
					"ownerName",
					"proprietario",
					"proprietário",
					"dono"
				],
				ownerDocument: [
					"ownerDocument",
					"cpfCnpj",
					"cpf_cnpj",
					"documento"
				],
				uc: [
					"uc",
					"unidadeConsumidora",
					"unidade_consumidora"
				],
				utilityCompany: [
					"utilityCompany",
					"distribuidora",
					"concessionaria",
					"concessionária"
				],
				status: ["status"]
			}
		},
		"beneficiary-units": {
			headers: [
				"id",
				"generatingUnitId",
				"name",
				"document",
				"uc",
				"utilityCompany",
				"status"
			],
			exampleRows: [[
				"ub-001",
				"gu-001",
				"Maria Santos",
				"987.654.321-00",
				"UC002",
				"COPEL",
				"active"
			]],
			aliases: {
				id: [
					"id",
					"codigo",
					"código"
				],
				generatingUnitId: [
					"generatingUnitId",
					"unidadeGeradoraId",
					"unidade_geradora_id",
					"ugId"
				],
				name: ["name", "nome"],
				document: [
					"document",
					"cpfCnpj",
					"cpf_cnpj",
					"documento"
				],
				uc: [
					"uc",
					"unidadeConsumidora",
					"unidade_consumidora"
				],
				utilityCompany: [
					"utilityCompany",
					"distribuidora",
					"concessionaria",
					"concessionária"
				],
				status: ["status"]
			}
		},
		"generating-unit-monthly-records": {
			headers: [
				"id",
				"generatingUnitId",
				"referenceMonth",
				"previousBalanceKwh",
				"monthlyGenerationKwh",
				"purchasePricePerKwh",
				"status"
			],
			exampleRows: [[
				"gum-001-2025-06",
				"gu-001",
				"2025-06",
				"500",
				"4500",
				"0.40",
				"active"
			]],
			aliases: {
				id: [
					"id",
					"codigo",
					"código"
				],
				generatingUnitId: [
					"generatingUnitId",
					"unidadeGeradoraId",
					"unidade_geradora_id",
					"ugId"
				],
				referenceMonth: [
					"referenceMonth",
					"mesReferencia",
					"mêsReferência",
					"mes_referencia"
				],
				previousBalanceKwh: [
					"previousBalanceKwh",
					"saldoAnteriorKwh",
					"saldo_anterior_kwh"
				],
				monthlyGenerationKwh: [
					"monthlyGenerationKwh",
					"geracaoMensalKwh",
					"geraçãoMensalKwh",
					"geracao_mensal_kwh"
				],
				purchasePricePerKwh: [
					"purchasePricePerKwh",
					"precoCompraKwh",
					"preçoCompraKwh",
					"preco_compra_kwh"
				],
				status: ["status"]
			}
		},
		"beneficiary-monthly-records": {
			headers: [
				"id",
				"beneficiaryUnitId",
				"generatingUnitId",
				"referenceMonth",
				"monthlyConsumptionKwh",
				"allocatedKwh",
				"compensatedKwh",
				"esaPricePerKwh",
				"utilityTariffPerKwh",
				"paymentStatus",
				"status"
			],
			exampleRows: [[
				"ubm-001-2025-06",
				"ub-001",
				"gu-001",
				"2025-06",
				"350",
				"350",
				"320",
				"0.35",
				"0.75",
				"pending",
				"active"
			]],
			aliases: {
				id: [
					"id",
					"codigo",
					"código"
				],
				beneficiaryUnitId: [
					"beneficiaryUnitId",
					"unidadeBeneficiariaId",
					"unidade_beneficiaria_id",
					"ubId"
				],
				generatingUnitId: [
					"generatingUnitId",
					"unidadeGeradoraId",
					"unidade_geradora_id",
					"ugId"
				],
				referenceMonth: [
					"referenceMonth",
					"mesReferencia",
					"mêsReferência",
					"mes_referencia"
				],
				monthlyConsumptionKwh: [
					"monthlyConsumptionKwh",
					"consumoMensalKwh",
					"consumo_mensal_kwh"
				],
				allocatedKwh: [
					"allocatedKwh",
					"creditosAlocadosKwh",
					"créditosAlocadosKwh",
					"creditos_alocados_kwh"
				],
				compensatedKwh: [
					"compensatedKwh",
					"creditosCompensadosKwh",
					"créditosCompensadosKwh",
					"creditos_compensados_kwh"
				],
				esaPricePerKwh: [
					"esaPricePerKwh",
					"precoEsaKwh",
					"preçoEsaKwh",
					"preco_esa_kwh"
				],
				utilityTariffPerKwh: [
					"utilityTariffPerKwh",
					"tarifaDistribuidoraKwh",
					"tarifa_distribuidora_kwh"
				],
				paymentStatus: [
					"paymentStatus",
					"statusPagamento",
					"status_pagamento"
				],
				status: ["status"]
			}
		}
	};
	var UNKNOWN_TYPE_ERROR = (importType) => ({
		code: "UNKNOWN_IMPORT_TYPE",
		message: `Tipo de importação desconhecido: ${importType}. Tipos válidos: ${Object.keys(TEMPLATES).join(", ")}`,
		field: "importType",
		metadata: {}
	});
	function _buildCsvText(def, delimiter) {
		return [
			def.headers.join(delimiter),
			...def.exampleRows.map((row) => row.join(delimiter)),
			""
		].join("\n");
	}
	var EnergyCreditsCsvTemplateService = class {
		getTemplate(importType, options = {}) {
			const def = TEMPLATES[importType];
			if (!def) return {
				ok: false,
				data: null,
				errors: [UNKNOWN_TYPE_ERROR(importType)],
				warnings: [],
				metadata: {}
			};
			const delimiter = options.delimiter || DELIMITER;
			const csvText = _buildCsvText(def, delimiter);
			return {
				ok: true,
				data: {
					importType,
					delimiter,
					headers: def.headers,
					exampleRows: def.exampleRows,
					csvText,
					aliases: def.aliases
				},
				errors: [],
				warnings: [],
				metadata: {
					importType,
					delimiter,
					headerCount: def.headers.length
				}
			};
		}
		getSupportedTypes() {
			return Object.keys(TEMPLATES);
		}
	};
	var energyCreditsCsvTemplateService = new EnergyCreditsCsvTemplateService();
	//#endregion
	//#region ../energy-credits-ui-result.js
	/**
	* ESA OS — UI / Energy Credits
	* UIResult
	*
	* Contrato único de resultado para toda a camada de UI de créditos ESA Energia.
	* Normaliza EnergyCreditsQueryResult, EnergyBillingResult, EnergyCreditsResult,
	* UtilityBillResult e EnergyCreditsRepositoryResult para um único envelope.
	*
	* { ok, data, errors, warnings, metadata }
	*/
	var UIResult = class UIResult {
		static ok(data, metadata = {}, warnings = []) {
			return Object.freeze({
				ok: true,
				data,
				errors: [],
				warnings: Array.isArray(warnings) ? warnings : [],
				metadata: metadata && typeof metadata === "object" ? metadata : {}
			});
		}
		static fail(errors, metadata = {}, warnings = []) {
			const errs = Array.isArray(errors) ? errors : [errors].filter(Boolean);
			return Object.freeze({
				ok: false,
				data: null,
				errors: errs,
				warnings: Array.isArray(warnings) ? warnings : [],
				metadata: metadata && typeof metadata === "object" ? metadata : {}
			});
		}
		static makeError(code, message, field = null, meta = {}) {
			return {
				code,
				message,
				field: field || null,
				metadata: meta || {}
			};
		}
		/**
		* Converte qualquer resultado da camada de aplicação para UIResult.
		*
		* Suporta:
		*  - EnergyCreditsQueryResult  { data, metadata, generatedAt } — sem .ok
		*  - EnergyBillingResult       { ok, snapshot, errors, warnings, metadata }
		*  - EnergyCreditsResult       { ok, data, errors, warnings, metadata }
		*  - UtilityBillResult         { ok, data, errors, warnings, metadata }
		*  - EnergyCreditsRepositoryResult { ok, data, errors, warnings, metadata }
		*/
		static fromApplicationResult(result) {
			if (result === null || result === void 0) return UIResult.fail([UIResult.makeError("NULL_RESULT", "Resultado nulo retornado pela aplicação")]);
			if (result.ok === void 0 && typeof result.toJSON === "function") {
				const json = result.toJSON();
				return UIResult.ok(json.data, Object.assign({}, json.metadata, { generatedAt: json.generatedAt }));
			}
			if (result.ok === void 0 && result.generatedAt !== void 0 && "data" in result && "metadata" in result) return UIResult.ok(result.data, Object.assign({}, result.metadata, { generatedAt: result.generatedAt }));
			if (result.ok !== void 0 && "snapshot" in result && !("data" in result)) {
				if (!result.ok) return UIResult.fail(result.errors || [], result.metadata || {}, result.warnings || []);
				return UIResult.ok(result.snapshot, result.metadata || {}, result.warnings || []);
			}
			if (result.ok !== void 0) {
				if (!result.ok) return UIResult.fail(result.errors || [], result.metadata || {}, result.warnings || []);
				return UIResult.ok(result.data, result.metadata || {}, result.warnings || []);
			}
			return UIResult.ok(result, {});
		}
	};
	//#endregion
	//#region ../energy-credits-ui-normalizer.js
	/**
	* ESA OS — UI / Energy Credits
	* EnergyCreditsUINormalizer
	*
	* Remove campos proibidos de qualquer objeto antes de expor para a UI.
	* Aplica recursivamente em objetos e arrays.
	*
	* Campos proibidos (em qualquer nível de aninhamento):
	*   calculationMemory, _internal, _debug, __raw, __meta,
	*   password, passHash, sessionToken, sessionExpiresAt,
	*   serviceAccount, firebaseConfig, apiKey, secret,
	*   downloadUrl, stack, stackTrace, internalLog
	*/
	var FORBIDDEN_KEYS = /* @__PURE__ */ new Set([
		"calculationMemory",
		"_internal",
		"_debug",
		"__raw",
		"__meta",
		"password",
		"passHash",
		"sessionToken",
		"sessionExpiresAt",
		"serviceAccount",
		"firebaseConfig",
		"apiKey",
		"secret",
		"downloadUrl",
		"stack",
		"stackTrace",
		"internalLog"
	]);
	var EnergyCreditsUINormalizer = class {
		normalize(data) {
			return this._strip(data);
		}
		_strip(value) {
			if (value === null || value === void 0) return value;
			if (Array.isArray(value)) return value.map((v) => this._strip(v));
			if (typeof value !== "object") return value;
			const result = {};
			for (const key of Object.keys(value)) if (!FORBIDDEN_KEYS.has(key)) result[key] = this._strip(value[key]);
			return result;
		}
	};
	//#endregion
	//#region ../energy-credits-ui-contract.js
	/**
	* ESA OS — UI / Energy Credits
	* Contrato de capacidades da UI de Créditos ESA Energia.
	*/
	var ENERGY_CREDITS_UI_CAPABILITIES = Object.freeze({
		DASHBOARD: Object.freeze([
			"executive_summary",
			"generating_unit_summary",
			"beneficiary_summary",
			"financial_summary",
			"alerts_summary"
		]),
		ALLOCATION: Object.freeze([
			"consumption_average",
			"allocation_plan",
			"beneficiary_balance",
			"credit_balance",
			"credit_balance_history",
			"allocation_plan_query",
			"consumption_average_query"
		]),
		BILLING: Object.freeze(["beneficiary_billing"]),
		REPORTS: Object.freeze([
			"owner_monthly_report",
			"beneficiary_monthly_report",
			"esa_internal_monthly_report",
			"esa_financial_monthly_report"
		]),
		CSV_IMPORT: Object.freeze(["import_from_csv", "import_from_rows"]),
		UTILITY_BILL_IMPORT: Object.freeze([
			"create",
			"match",
			"link",
			"prepare_beneficiary",
			"review",
			"duplicate_detect",
			"confirm",
			"replace",
			"discard",
			"query",
			"search",
			"unlinked",
			"data_sources",
			"billing_input"
		]),
		CADASTROS: Object.freeze([
			"create_generating_unit",
			"create_beneficiary_unit",
			"update_generating_unit",
			"update_beneficiary_unit"
		]),
		COMMERCIAL_TERMS: Object.freeze(["get", "update"]),
		SETTLEMENT_RECIPIENT: Object.freeze(["get", "update"]),
		INVOICE_PAYMENT: Object.freeze(["confirm", "reopen"]),
		OWNER_SETTLEMENT_PAYMENT: Object.freeze(["confirm", "reopen"]),
		CSV_TEMPLATE: Object.freeze(["get", "supported_types"]),
		PROVIDER: Object.freeze(["get_capabilities", "get_stats"])
	});
	var ENERGY_CREDITS_UI_VERSION = "1.0.0";
	//#endregion
	//#region ../energy-credits-ui-provider.js
	/**
	* ESA OS — UI / Energy Credits
	* EnergyCreditsUIProvider
	*
	* Bridge técnica entre a UI de Créditos ESA Energia e as APIs públicas do ESAApplication.
	* Não renderiza tela. Não conecta Firebase diretamente. Não tem estado próprio.
	*
	* Responsabilidades:
	*  1. Traduzir chamadas da UI → ESAApplication public APIs
	*  2. Normalizar todos os resultados para UIResult { ok, data, errors, warnings, metadata }
	*  3. Remover campos proibidos (calculationMemory, password, secret, etc.) antes de retornar
	*
	* Uso:
	*   const provider = new EnergyCreditsUIProvider(esaApplication);
	*   const result   = provider.getExecutiveSummary({ referenceMonth: '2025-06' });
	*   // result: { ok, data, errors, warnings, metadata }
	*/
	var EnergyCreditsUIProvider = class {
		constructor(esaApplication) {
			if (!esaApplication || typeof esaApplication !== "object") throw new TypeError("[EnergyCreditsUIProvider] esaApplication é obrigatório");
			this._esa = esaApplication;
			this._norm = new EnergyCreditsUINormalizer();
		}
		_wrap(result) {
			const uir = UIResult.fromApplicationResult(result);
			if (!uir.ok) return uir;
			return UIResult.ok(this._norm.normalize(uir.data), uir.metadata, uir.warnings);
		}
		_fail(code, message, field = null) {
			return UIResult.fail([UIResult.makeError(code, message, field)]);
		}
		getExecutiveSummary(filters = {}) {
			return this._wrap(this._esa.getEnergyCreditsExecutiveSummary(filters));
		}
		getGeneratingUnitSummary(generatingUnitId, filters = {}) {
			return this._wrap(this._esa.getEnergyCreditsGeneratingUnitSummary(generatingUnitId, filters));
		}
		getBeneficiarySummary(beneficiaryUnitId, filters = {}) {
			return this._wrap(this._esa.getEnergyCreditsBeneficiarySummary(beneficiaryUnitId, filters));
		}
		getFinancialSummary(filters = {}) {
			return this._wrap(this._esa.getEnergyCreditsFinancialSummary(filters));
		}
		getAlertsSummary(filters = {}) {
			return this._wrap(this._esa.getEnergyCreditsAlertsSummary(filters));
		}
		queryGeneratingUnit(id, options = {}) {
			return this._wrap(this._esa.queryEnergyCreditsGeneratingUnit(id, options));
		}
		queryBeneficiaryUnit(id, options = {}) {
			return this._wrap(this._esa.queryEnergyCreditsBeneficiaryUnit(id, options));
		}
		searchGeneratingUnits(filters = {}, options = {}) {
			return this._wrap(this._esa.searchEnergyCreditsGeneratingUnits(filters, options));
		}
		searchBeneficiaryUnits(filters = {}, options = {}) {
			return this._wrap(this._esa.searchEnergyCreditsBeneficiaryUnits(filters, options));
		}
		getMonthlyStatement(generatingUnitId, referenceMonth, options = {}) {
			return this._wrap(this._esa.getEnergyCreditsMonthlyStatement(generatingUnitId, referenceMonth, options));
		}
		getGeneratingUnitHistory(generatingUnitId, filters = {}, options = {}) {
			return this._wrap(this._esa.getEnergyCreditsGeneratingUnitHistory(generatingUnitId, filters, options));
		}
		getBeneficiaryHistory(beneficiaryUnitId, filters = {}, options = {}) {
			return this._wrap(this._esa.getEnergyCreditsBeneficiaryHistory(beneficiaryUnitId, filters, options));
		}
		calculateConsumptionAverage(input = {}) {
			return this._wrap(this._esa.calculateEnergyCreditsConsumptionAverage(input));
		}
		calculateAllocationPlan(input = {}) {
			return this._wrap(this._esa.calculateEnergyCreditsAllocationPlan(input));
		}
		calculateBeneficiaryBalance(input = {}) {
			return this._wrap(this._esa.calculateEnergyCreditsBeneficiaryBalance(input));
		}
		getBeneficiaryCreditBalance(beneficiaryUnitId, referenceMonth, options = {}) {
			return this._wrap(this._esa.getEnergyCreditsBeneficiaryCreditBalance(beneficiaryUnitId, referenceMonth, options));
		}
		getBeneficiaryCreditBalanceHistory(beneficiaryUnitId, filters = {}, options = {}) {
			return this._wrap(this._esa.getEnergyCreditsBeneficiaryCreditBalanceHistory(beneficiaryUnitId, filters, options));
		}
		getAllocationPlan(generatingUnitId, referenceMonth, options = {}) {
			return this._wrap(this._esa.getEnergyCreditsAllocationPlan(generatingUnitId, referenceMonth, options));
		}
		getBeneficiaryConsumptionAverage(beneficiaryUnitId, filters = {}, options = {}) {
			return this._wrap(this._esa.getEnergyCreditsBeneficiaryConsumptionAverage(beneficiaryUnitId, filters, options));
		}
		calculateBeneficiaryBilling(input = {}) {
			return this._wrap(this._esa.calculateEnergyBeneficiaryBilling(input));
		}
		getOwnerMonthlyReport(generatingUnitId, referenceMonth, options = {}) {
			return this._wrap(this._esa.buildEnergyCreditsOwnerMonthlyReport(generatingUnitId, referenceMonth, options));
		}
		getBeneficiaryMonthlyReport(beneficiaryUnitId, referenceMonth, options = {}) {
			return this._wrap(this._esa.buildEnergyCreditsBeneficiaryMonthlyReport(beneficiaryUnitId, referenceMonth, options));
		}
		getEsaInternalMonthlyReport(referenceMonth, options = {}) {
			return this._wrap(this._esa.buildEnergyCreditsEsaInternalMonthlyReport(referenceMonth, options));
		}
		getEsaFinancialMonthlyReport(referenceMonth, options = {}) {
			return this._wrap(this._esa.buildEnergyCreditsEsaFinancialMonthlyReport(referenceMonth, options));
		}
		importFromCsv(importType, csvText, options = {}) {
			return this._wrap(this._esa.importEnergyCreditsFromCsv(importType, csvText, options));
		}
		importFromRows(importType, rows, options = {}) {
			return this._wrap(this._esa.importEnergyCreditsFromRows(importType, rows, options));
		}
		getCsvTemplate(importType, options = {}) {
			return this._wrap(this._esa.getEnergyCreditsCsvTemplate(importType, options));
		}
		createUtilityBillImport(rawExtraction, options = {}) {
			return this._wrap(this._esa.createEnergyUtilityBillImport(rawExtraction, options));
		}
		matchUtilityBillImport(importId, beneficiaryUnits, options = {}) {
			return this._wrap(this._esa.matchEnergyUtilityBillImport(importId, beneficiaryUnits, options));
		}
		linkUtilityBillToBeneficiary(importId, beneficiaryUnitId, context = {}) {
			return this._wrap(this._esa.linkEnergyUtilityBillToBeneficiary(importId, beneficiaryUnitId, context));
		}
		prepareBeneficiaryFromUtilityBill(importId) {
			return this._wrap(this._esa.prepareEnergyCreditsBeneficiaryFromUtilityBill(importId));
		}
		reviewUtilityBillImport(importId, correctedData, options = {}) {
			return this._wrap(this._esa.reviewEnergyUtilityBillImport(importId, correctedData, options));
		}
		detectUtilityBillDuplicate(importId, existingMonthlyRecords, options = {}) {
			return this._wrap(this._esa.detectEnergyUtilityBillDuplicate(importId, existingMonthlyRecords, options));
		}
		confirmUtilityBillMonthlyRecord(importId, options = {}) {
			return this._wrap(this._esa.confirmEnergyUtilityBillMonthlyRecord(importId, options));
		}
		replaceUtilityBillMonthlyRecord(importId, replacementReason, options = {}) {
			return this._wrap(this._esa.replaceEnergyUtilityBillMonthlyRecord(importId, replacementReason, options));
		}
		discardUtilityBillImport(importId, options = {}) {
			return this._wrap(this._esa.discardEnergyUtilityBillImport(importId, options));
		}
		getUtilityBillImport(importId) {
			return this._wrap(this._esa.getEnergyUtilityBillImport(importId));
		}
		searchUtilityBillImports(filters = {}) {
			return this._wrap(this._esa.searchEnergyUtilityBillImports(filters));
		}
		getUnlinkedUtilityBills(filters = {}) {
			return this._wrap(this._esa.getUnlinkedEnergyUtilityBills(filters));
		}
		getBeneficiaryMonthlyDataSources(beneficiaryUnitId, referenceMonth, options = {}) {
			return this._wrap(this._esa.getEnergyCreditsBeneficiaryMonthlyDataSources(beneficiaryUnitId, referenceMonth, options));
		}
		buildBillingInputFromUtilityBill(monthlyRecord, context = {}) {
			return this._wrap(this._esa.buildEnergyBillingInputFromUtilityBillMonthlyRecord(monthlyRecord, context));
		}
		createGeneratingUnit(input, options = {}) {
			return this._wrap(this._esa.createEnergyCreditsGeneratingUnit(input, options));
		}
		createBeneficiaryUnit(input, options = {}) {
			return this._wrap(this._esa.createEnergyCreditsBeneficiaryUnit(input, options));
		}
		updateGeneratingUnit(id, input, options = {}) {
			return this._wrap(this._esa.updateEnergyCreditsGeneratingUnit(id, input, options));
		}
		updateBeneficiaryUnit(id, input, options = {}) {
			return this._wrap(this._esa.updateEnergyCreditsBeneficiaryUnit(id, input, options));
		}
		getGeneratingUnitCommercialTerms(generatingUnitId, options = {}) {
			return this._wrap(this._esa.getEnergyCreditsGeneratingUnitCommercialTerms(generatingUnitId, options));
		}
		updateGeneratingUnitCommercialTerms(generatingUnitId, input, options = {}) {
			return this._wrap(this._esa.updateEnergyCreditsGeneratingUnitCommercialTerms(generatingUnitId, input, options));
		}
		getSettlementRecipient(generatingUnitId, options = {}) {
			return this._wrap(this._esa.getEnergyCreditsSettlementRecipient(generatingUnitId, options));
		}
		updateSettlementRecipient(generatingUnitId, input, options = {}) {
			return this._wrap(this._esa.updateEnergyCreditsSettlementRecipient(generatingUnitId, input, options));
		}
		confirmInvoicePayment(invoiceId, paymentData, options = {}) {
			return this._wrap(this._esa.confirmEnergyCreditsInvoicePayment(invoiceId, paymentData, options));
		}
		reopenInvoicePayment(invoiceId, reason, options = {}) {
			return this._wrap(this._esa.reopenEnergyCreditsInvoicePayment(invoiceId, reason, options));
		}
		confirmOwnerSettlementPayment(settlementId, paymentData, options = {}) {
			return this._wrap(this._esa.confirmEnergyCreditsOwnerSettlementPayment(settlementId, paymentData, options));
		}
		reopenOwnerSettlementPayment(settlementId, reason, options = {}) {
			return this._wrap(this._esa.reopenEnergyCreditsOwnerSettlementPayment(settlementId, reason, options));
		}
		getCapabilities() {
			return UIResult.ok({
				version: ENERGY_CREDITS_UI_VERSION,
				esaVersion: this._esa.version || null,
				capabilities: ENERGY_CREDITS_UI_CAPABILITIES
			});
		}
		getStats() {
			const caps = ENERGY_CREDITS_UI_CAPABILITIES;
			const totalCapabilities = Object.values(caps).reduce((acc, arr) => acc + arr.length, 0);
			return UIResult.ok({
				version: ENERGY_CREDITS_UI_VERSION,
				esaVersion: this._esa.version || null,
				capabilityGroups: Object.keys(caps).length,
				totalCapabilities
			});
		}
	};
	//#endregion
	//#region ../../../core/app.js
	/**
	* ESA OS
	* Core Bootstrap
	*
	* Núcleo da plataforma ESA OS.
	* Orquestra a inicialização dos módulos core e das integrações.
	*
	* IMPORTANTE:
	* Não conectar diretamente ao Dashboard legado (index.html).
	* O bridge de integração (CRMLegacyEventBridge) é o único ponto de contato controlado.
	*/
	var ESAApplication = class {
		constructor() {
			this.version = "2.0.0-alpha";
			this.firebase = new FirebaseService();
			this.crmLegacyBridge = null;
			this.crmReadModelHydrator = null;
			this._solanaContextBuilder = null;
			this._energyCreditsService = null;
			this._utilityBillImportService = null;
			this._utilityBillQueryService = null;
		}
		initialize() {
			console.log("==================================");
			console.log("ESA OS");
			console.log("Versão:", this.version);
			console.log("Inicializando plataforma...");
			console.log("==================================");
			this.firebase.initialize();
			if (!integrationRegistry.get("crmAudit")) integrationRegistry.register("crmAudit", new CRMAuditIntegration(eventBus, audit, logger));
			if (!integrationRegistry.get("crmAudit").isStarted()) integrationRegistry.start("crmAudit");
			if (!integrationRegistry.get("crmReadModel")) integrationRegistry.register("crmReadModel", new CRMReadModelIntegration(eventBus, crmReadModel, logger));
			if (!integrationRegistry.get("crmReadModel").isStarted()) integrationRegistry.start("crmReadModel");
			if (!this.crmLegacyBridge) this.crmLegacyBridge = new CRMLegacyEventBridge(eventBus);
			if (!this.crmReadModelHydrator) this.crmReadModelHydrator = new CRMLegacyReadModelHydrator(crmReadModel, logger);
			console.log("ESA OS iniciada com sucesso.");
		}
		getCoreStats() {
			return {
				version: this.version,
				firebaseInitialized: this.firebase.isInitialized(),
				integrations: integrationRegistry.getStats(),
				logger: logger.getStats()
			};
		}
		getCRMAuditStats() {
			return integrationRegistry.get("crmAudit")?.getStats() || null;
		}
		getCRMReadModelStats() {
			return {
				integration: integrationRegistry.get("crmReadModel")?.getStats() || null,
				readModel: crmReadModel.getStats()
			};
		}
		getCRMMetrics(filters = {}) {
			return crmQueryService.getMetrics(filters).toJSON();
		}
		getCRMPipeline(filters = {}) {
			return crmQueryService.getPipeline(filters).toJSON();
		}
		getCRMStatusSummary(filters = {}) {
			return crmQueryService.getStatusSummary(filters).toJSON();
		}
		queryCRMDeal(dealId) {
			return crmQueryService.getDeal(dealId).toJSON();
		}
		searchCRMDeals(filters = {}) {
			return crmQueryService.searchDeals(filters).toJSON();
		}
		getCRMForecast(filters = {}) {
			return crmQueryService.getForecast(filters).toJSON();
		}
		getCRMExecutiveSummary(filters = {}) {
			return crmQueryService.getExecutiveSummary(filters).toJSON();
		}
		getCRMPipelineHealth(filters = {}, options = {}) {
			return crmQueryService.getPipelineHealth(filters, options).toJSON();
		}
		getCRMCriticalDeals(filters = {}, options = {}) {
			return crmQueryService.getCriticalDeals(filters, options).toJSON();
		}
		getCRMDealsWithoutNextAction(filters = {}, options = {}) {
			return crmQueryService.getDealsWithoutNextAction(filters, options).toJSON();
		}
		getCRMRiskSignals(filters = {}, options = {}) {
			return crmQueryService.getRiskSignals(filters, options).toJSON();
		}
		getCRMCriticalRiskSignals(filters = {}, options = {}) {
			return crmQueryService.getCriticalRiskSignals(filters, options).toJSON();
		}
		getCRMRiskSignalSummary(filters = {}, options = {}) {
			return crmQueryService.getRiskSignalSummary(filters, options).toJSON();
		}
		getCRMActionPriorities(filters = {}, options = {}) {
			return crmQueryService.getActionPriorities(filters, options).toJSON();
		}
		getCRMUrgentActionPriorities(filters = {}, options = {}) {
			return crmQueryService.getUrgentActionPriorities(filters, options).toJSON();
		}
		getCRMActionPrioritySummary(filters = {}, options = {}) {
			return crmQueryService.getActionPrioritySummary(filters, options).toJSON();
		}
		getCRMManagementBrief(filters = {}, options = {}) {
			return crmQueryService.getManagementBrief(filters, options).toJSON();
		}
		getEnergyCreditsService() {
			if (!this._energyCreditsService) this._energyCreditsService = new EnergyCreditsService();
			return this._energyCreditsService;
		}
		hydrateEnergyCreditsReadModel(snapshot = {}, options = {}) {
			return energyCreditsReadModel.hydrate(snapshot, options);
		}
		getEnergyCreditsReadModelStats() {
			return energyCreditsReadModel.getStats();
		}
		queryEnergyCreditsGeneratingUnit(id, options = {}) {
			return energyCreditsQueryService.getGeneratingUnit(id, options).toJSON();
		}
		queryEnergyCreditsBeneficiaryUnit(id, options = {}) {
			return energyCreditsQueryService.getBeneficiaryUnit(id, options).toJSON();
		}
		searchEnergyCreditsGeneratingUnits(filters = {}, options = {}) {
			return energyCreditsQueryService.searchGeneratingUnits(filters, options).toJSON();
		}
		searchEnergyCreditsBeneficiaryUnits(filters = {}, options = {}) {
			return energyCreditsQueryService.searchBeneficiaryUnits(filters, options).toJSON();
		}
		getEnergyCreditsMonthlyStatement(generatingUnitId, referenceMonth, options = {}) {
			return energyCreditsQueryService.getMonthlyStatement(generatingUnitId, referenceMonth, options).toJSON();
		}
		getEnergyCreditsGeneratingUnitHistory(generatingUnitId, filters = {}, options = {}) {
			return energyCreditsQueryService.getGeneratingUnitMonthlyHistory(generatingUnitId, filters, options).toJSON();
		}
		getEnergyCreditsBeneficiaryHistory(beneficiaryUnitId, filters = {}, options = {}) {
			return energyCreditsQueryService.getBeneficiaryMonthlyHistory(beneficiaryUnitId, filters, options).toJSON();
		}
		getEnergyCreditsExecutiveSummary(filters = {}, options = {}) {
			return energyCreditsQueryService.getExecutiveSummary(filters, options).toJSON();
		}
		getEnergyCreditsGeneratingUnitSummary(generatingUnitId, filters = {}, options = {}) {
			return energyCreditsQueryService.getGeneratingUnitSummary(generatingUnitId, filters, options).toJSON();
		}
		getEnergyCreditsBeneficiarySummary(beneficiaryUnitId, filters = {}, options = {}) {
			return energyCreditsQueryService.getBeneficiarySummary(beneficiaryUnitId, filters, options).toJSON();
		}
		getEnergyCreditsFinancialSummary(filters = {}, options = {}) {
			return energyCreditsQueryService.getFinancialSummary(filters, options).toJSON();
		}
		getEnergyCreditsAlertsSummary(filters = {}, options = {}) {
			return energyCreditsQueryService.getAlertsSummary(filters, options).toJSON();
		}
		getSolanaCommercialContext(filters = {}, options = {}) {
			if (!this._solanaContextBuilder) this._solanaContextBuilder = new SolanaCommercialContextBuilder(crmQueryService);
			return this._solanaContextBuilder.generateContext(filters, options);
		}
		buildEnergyCreditsOwnerMonthlyReport(generatingUnitId, referenceMonth, options = {}) {
			return energyCreditsReportService.buildOwnerMonthlyReport(generatingUnitId, referenceMonth, options).toJSON();
		}
		buildEnergyCreditsBeneficiaryMonthlyReport(beneficiaryUnitId, referenceMonth, options = {}) {
			return energyCreditsReportService.buildBeneficiaryMonthlyReport(beneficiaryUnitId, referenceMonth, options).toJSON();
		}
		buildEnergyCreditsEsaInternalMonthlyReport(referenceMonth, options = {}) {
			return energyCreditsReportService.buildEsaInternalMonthlyReport(referenceMonth, options).toJSON();
		}
		buildEnergyCreditsEsaFinancialMonthlyReport(referenceMonth, options = {}) {
			return energyCreditsReportService.buildEsaFinancialMonthlyReport(referenceMonth, options).toJSON();
		}
		getEnergyCreditsRepository() {
			return energyCreditsRepository;
		}
		getEnergyCreditsRepositoryStats() {
			return energyCreditsRepository.getStats();
		}
		hydrateEnergyCreditsFromRepository(options = {}) {
			return energyCreditsRepositoryHydrator.hydrateReadModel(options);
		}
		createEnergyCreditsFirebaseRepository(firebaseClient, options = {}) {
			return new EnergyCreditsFirebaseRepository(firebaseClient, options);
		}
		importEnergyCreditsFromCsv(importType, csvText, options = {}) {
			const opts = this._enrichImportOptions(options);
			return energyCreditsImportService.importFromCsv(importType, csvText, opts);
		}
		importEnergyCreditsFromRows(importType, rows, options = {}) {
			const opts = this._enrichImportOptions(options);
			return energyCreditsImportService.importFromRows(importType, rows, opts);
		}
		createEnergyCreditsImportService(mapper = null, validator = null, parser = null) {
			return new EnergyCreditsImportService(mapper, validator, parser);
		}
		_enrichImportOptions(options) {
			const enriched = Object.assign({}, options);
			if (enriched.persist && !enriched.repository) enriched.repository = energyCreditsRepository;
			if (enriched.hydrateReadModel && !enriched.hydrator) enriched.hydrator = energyCreditsRepositoryHydrator;
			return enriched;
		}
		getEnergyBillingEngine() {
			return energyBillingEngine;
		}
		calculateEnergyBeneficiaryBilling(input = {}) {
			return energyBillingEngine.calculateBeneficiaryBilling(input);
		}
		calculateEnergyCreditsConsumptionAverage(input = {}) {
			return consumptionAverageCalculator.calculate(input);
		}
		calculateEnergyCreditsAllocationPlan(input = {}) {
			return creditAllocationPlanner.planAllocation(input);
		}
		calculateEnergyCreditsBeneficiaryBalance(input = {}) {
			return beneficiaryCreditBalanceCalculator.calculate(input);
		}
		getEnergyCreditsBeneficiaryCreditBalance(beneficiaryUnitId, referenceMonth, options = {}) {
			return energyCreditsQueryService.getBeneficiaryCreditBalance(beneficiaryUnitId, referenceMonth, options).toJSON();
		}
		getEnergyCreditsBeneficiaryCreditBalanceHistory(beneficiaryUnitId, filters = {}, options = {}) {
			return energyCreditsQueryService.getBeneficiaryCreditBalanceHistory(beneficiaryUnitId, filters, options).toJSON();
		}
		getEnergyCreditsAllocationPlan(generatingUnitId, referenceMonth, options = {}) {
			return energyCreditsQueryService.getCreditAllocationPlan(generatingUnitId, referenceMonth, options).toJSON();
		}
		_ensureUtilityBillServices() {
			if (!this._utilityBillImportService) {
				this._utilityBillImportService = new UtilityBillImportService();
				this._utilityBillQueryService = new UtilityBillQueryService(this._utilityBillImportService);
			}
		}
		getEnergyUtilityBillImportService() {
			this._ensureUtilityBillServices();
			return this._utilityBillImportService;
		}
		createEnergyUtilityBillImport(rawExtraction, options = {}) {
			this._ensureUtilityBillServices();
			return this._utilityBillImportService.createImport(rawExtraction, options);
		}
		matchEnergyUtilityBillImport(importId, beneficiaryUnits, options = {}) {
			this._ensureUtilityBillServices();
			return this._utilityBillImportService.matchImport(importId, beneficiaryUnits, options);
		}
		linkEnergyUtilityBillToBeneficiary(importId, beneficiaryUnitId, context = {}) {
			this._ensureUtilityBillServices();
			return this._utilityBillImportService.linkImportToBeneficiary(importId, beneficiaryUnitId, context);
		}
		prepareEnergyCreditsBeneficiaryFromUtilityBill(importId) {
			this._ensureUtilityBillServices();
			return this._utilityBillImportService.prepareBeneficiaryFromImport(importId);
		}
		reviewEnergyUtilityBillImport(importId, correctedData, options = {}) {
			this._ensureUtilityBillServices();
			return this._utilityBillImportService.reviewImport(importId, correctedData, options);
		}
		detectEnergyUtilityBillDuplicate(importId, existingMonthlyRecords, options = {}) {
			this._ensureUtilityBillServices();
			return this._utilityBillImportService.detectDuplicate(importId, existingMonthlyRecords, options);
		}
		confirmEnergyUtilityBillMonthlyRecord(importId, options = {}) {
			this._ensureUtilityBillServices();
			return this._utilityBillImportService.confirmMonthlyRecord(importId, options);
		}
		replaceEnergyUtilityBillMonthlyRecord(importId, replacementReason, options = {}) {
			this._ensureUtilityBillServices();
			return this._utilityBillImportService.replaceMonthlyRecord(importId, replacementReason, options);
		}
		discardEnergyUtilityBillImport(importId, options = {}) {
			this._ensureUtilityBillServices();
			return this._utilityBillImportService.discardImport(importId, options);
		}
		getEnergyUtilityBillImport(importId) {
			this._ensureUtilityBillServices();
			return this._utilityBillQueryService.getUtilityBillImport(importId);
		}
		searchEnergyUtilityBillImports(filters = {}) {
			this._ensureUtilityBillServices();
			return this._utilityBillQueryService.searchUtilityBillImports(filters);
		}
		getUnlinkedEnergyUtilityBills(filters = {}) {
			this._ensureUtilityBillServices();
			return this._utilityBillQueryService.getUnlinkedUtilityBills(filters);
		}
		buildEnergyBillingInputFromUtilityBillMonthlyRecord(monthlyRecord, context = {}) {
			return buildBillingInputFromUtilityBillMonthlyRecord(monthlyRecord, context);
		}
		createEnergyCreditsGeneratingUnit(input, options = {}) {
			const result = this.getEnergyCreditsService().createGeneratingUnit(input);
			if (!result.ok || !options.persist) return result;
			(options.repository || energyCreditsRepository).saveGeneratingUnit(result.data);
			return result;
		}
		createEnergyCreditsBeneficiaryUnit(input, options = {}) {
			const result = this.getEnergyCreditsService().createBeneficiaryUnit(input);
			if (!result.ok || !options.persist) return result;
			(options.repository || energyCreditsRepository).saveBeneficiaryUnit(result.data);
			return result;
		}
		updateEnergyCreditsGeneratingUnit(id, input, options = {}) {
			let existing = options.existing || null;
			if (options.persist) {
				const loaded = (options.repository || energyCreditsRepository).getGeneratingUnit(id);
				if (!loaded.ok || !loaded.data) return {
					ok: false,
					data: null,
					errors: [{
						code: "GU_NOT_FOUND",
						message: `UG ${id} não encontrada`,
						field: "id",
						metadata: {}
					}],
					warnings: [],
					metadata: {}
				};
				existing = loaded.data;
			}
			if (!existing) return {
				ok: false,
				data: null,
				errors: [{
					code: "GU_NOT_FOUND",
					message: `UG ${id} não encontrada. Forneça options.existing para modo preview.`,
					field: "id",
					metadata: {}
				}],
				warnings: [],
				metadata: {}
			};
			const updated = Object.assign({}, existing, input, { id });
			if (options.persist) (options.repository || energyCreditsRepository).saveGeneratingUnit(updated);
			return {
				ok: true,
				data: updated,
				errors: [],
				warnings: [],
				metadata: {}
			};
		}
		updateEnergyCreditsBeneficiaryUnit(id, input, options = {}) {
			let existing = options.existing || null;
			if (options.persist) {
				const loaded = (options.repository || energyCreditsRepository).getBeneficiaryUnit(id);
				if (!loaded.ok || !loaded.data) return {
					ok: false,
					data: null,
					errors: [{
						code: "UB_NOT_FOUND",
						message: `UB ${id} não encontrada`,
						field: "id",
						metadata: {}
					}],
					warnings: [],
					metadata: {}
				};
				existing = loaded.data;
			}
			if (!existing) return {
				ok: false,
				data: null,
				errors: [{
					code: "UB_NOT_FOUND",
					message: `UB ${id} não encontrada. Forneça options.existing para modo preview.`,
					field: "id",
					metadata: {}
				}],
				warnings: [],
				metadata: {}
			};
			const updated = Object.assign({}, existing, input, { id });
			if (options.persist) (options.repository || energyCreditsRepository).saveBeneficiaryUnit(updated);
			return {
				ok: true,
				data: updated,
				errors: [],
				warnings: [],
				metadata: {}
			};
		}
		getEnergyCreditsGeneratingUnitCommercialTerms(generatingUnitId, options = {}) {
			let unit = options.existing || null;
			if (!unit) unit = energyCreditsQueryService.getGeneratingUnit(generatingUnitId, options).data;
			if (!unit) return {
				ok: false,
				data: null,
				errors: [{
					code: "GU_NOT_FOUND",
					message: `UG ${generatingUnitId} não encontrada`,
					field: "generatingUnitId",
					metadata: {}
				}],
				warnings: [],
				metadata: {}
			};
			return {
				ok: true,
				data: {
					generatingUnitId,
					purchasePricePerKwh: unit.purchasePricePerKwh || null,
					effectiveFrom: unit.effectiveFrom || null,
					notes: unit.notes || null
				},
				errors: [],
				warnings: [],
				metadata: {}
			};
		}
		updateEnergyCreditsGeneratingUnitCommercialTerms(generatingUnitId, input, options = {}) {
			const COMMERCIAL_FIELDS = [
				"purchasePricePerKwh",
				"effectiveFrom",
				"notes"
			];
			const patch = {};
			for (const f of COMMERCIAL_FIELDS) if (input[f] !== void 0) patch[f] = input[f];
			return this.updateEnergyCreditsGeneratingUnit(generatingUnitId, patch, options);
		}
		getEnergyCreditsSettlementRecipient(generatingUnitId, options = {}) {
			let unit = options.existing || null;
			if (!unit) unit = energyCreditsQueryService.getGeneratingUnit(generatingUnitId, options).data;
			if (!unit) return {
				ok: false,
				data: null,
				errors: [{
					code: "GU_NOT_FOUND",
					message: `UG ${generatingUnitId} não encontrada`,
					field: "generatingUnitId",
					metadata: {}
				}],
				warnings: [],
				metadata: {}
			};
			return {
				ok: true,
				data: {
					generatingUnitId,
					recipientName: unit.recipientName || unit.ownerName || null,
					recipientDocument: unit.recipientDocument || unit.ownerDocument || null,
					pixKeyType: unit.pixKeyType || null,
					pixKey: unit.pixKey || null
				},
				errors: [],
				warnings: [],
				metadata: {}
			};
		}
		updateEnergyCreditsSettlementRecipient(generatingUnitId, input, options = {}) {
			const RECIPIENT_FIELDS = [
				"recipientName",
				"recipientDocument",
				"pixKeyType",
				"pixKey"
			];
			const patch = {};
			for (const f of RECIPIENT_FIELDS) if (input[f] !== void 0) patch[f] = input[f];
			return this.updateEnergyCreditsGeneratingUnit(generatingUnitId, patch, options);
		}
		confirmEnergyCreditsInvoicePayment(invoiceId, paymentData, options = {}) {
			let invoice = options.invoice || null;
			if (!invoice && options.persist) {
				const loaded = (options.repository || energyCreditsRepository).getEsaInvoice(invoiceId);
				if (!loaded.ok || !loaded.data) return {
					ok: false,
					data: null,
					errors: [{
						code: "INVOICE_NOT_FOUND",
						message: `Fatura ${invoiceId} não encontrada`,
						field: "invoiceId",
						metadata: {}
					}],
					warnings: [],
					metadata: {}
				};
				invoice = loaded.data;
			}
			if (!invoice) return {
				ok: false,
				data: null,
				errors: [{
					code: "INVOICE_NOT_FOUND",
					message: `Fatura ${invoiceId} não encontrada. Forneça options.invoice para modo preview.`,
					field: "invoiceId",
					metadata: {}
				}],
				warnings: [],
				metadata: {}
			};
			const confirmed = Object.assign({}, invoice, {
				paymentStatus: "paid",
				paidAt: paymentData.paidAt || options.referenceDate || null,
				paidAmount: paymentData.paidAmount != null ? paymentData.paidAmount : invoice.invoiceAmount || null,
				paymentNotes: paymentData.paymentNotes || null,
				paymentMethod: paymentData.paymentMethod || null
			});
			if (options.persist) (options.repository || energyCreditsRepository).saveEsaInvoice(confirmed);
			return {
				ok: true,
				data: confirmed,
				errors: [],
				warnings: [],
				metadata: { action: "invoice.payment.confirmed" }
			};
		}
		reopenEnergyCreditsInvoicePayment(invoiceId, reason, options = {}) {
			if (!reason || typeof reason !== "string" || !reason.trim()) return {
				ok: false,
				data: null,
				errors: [{
					code: "REOPEN_REASON_REQUIRED",
					message: "Motivo de reabertura é obrigatório",
					field: "reason",
					metadata: {}
				}],
				warnings: [],
				metadata: {}
			};
			let invoice = options.invoice || null;
			if (!invoice && options.persist) {
				const loaded = (options.repository || energyCreditsRepository).getEsaInvoice(invoiceId);
				if (!loaded.ok || !loaded.data) return {
					ok: false,
					data: null,
					errors: [{
						code: "INVOICE_NOT_FOUND",
						message: `Fatura ${invoiceId} não encontrada`,
						field: "invoiceId",
						metadata: {}
					}],
					warnings: [],
					metadata: {}
				};
				invoice = loaded.data;
			}
			if (!invoice) return {
				ok: false,
				data: null,
				errors: [{
					code: "INVOICE_NOT_FOUND",
					message: `Fatura ${invoiceId} não encontrada. Forneça options.invoice para modo preview.`,
					field: "invoiceId",
					metadata: {}
				}],
				warnings: [],
				metadata: {}
			};
			const reopened = Object.assign({}, invoice, {
				paymentStatus: "open",
				paidAt: null,
				paidAmount: null,
				paymentNotes: null,
				paymentMethod: null,
				reopenReason: reason.trim()
			});
			if (options.persist) (options.repository || energyCreditsRepository).saveEsaInvoice(reopened);
			return {
				ok: true,
				data: reopened,
				errors: [],
				warnings: [],
				metadata: { action: "invoice.payment.reopened" }
			};
		}
		confirmEnergyCreditsOwnerSettlementPayment(settlementId, paymentData, options = {}) {
			let settlement = options.settlement || null;
			if (!settlement && options.persist) {
				const loaded = (options.repository || energyCreditsRepository).getOwnerSettlement(settlementId);
				if (!loaded.ok || !loaded.data) return {
					ok: false,
					data: null,
					errors: [{
						code: "SETTLEMENT_NOT_FOUND",
						message: `Repasse ${settlementId} não encontrado`,
						field: "settlementId",
						metadata: {}
					}],
					warnings: [],
					metadata: {}
				};
				settlement = loaded.data;
			}
			if (!settlement) return {
				ok: false,
				data: null,
				errors: [{
					code: "SETTLEMENT_NOT_FOUND",
					message: `Repasse ${settlementId} não encontrado. Forneça options.settlement para modo preview.`,
					field: "settlementId",
					metadata: {}
				}],
				warnings: [],
				metadata: {}
			};
			const confirmed = Object.assign({}, settlement, {
				paymentStatus: "paid",
				paidAt: paymentData.paidAt || options.referenceDate || null,
				paidAmount: paymentData.paidAmount != null ? paymentData.paidAmount : settlement.netReturn || null,
				paymentNotes: paymentData.paymentNotes || null,
				paymentMethod: paymentData.paymentMethod || null
			});
			if (options.persist) (options.repository || energyCreditsRepository).saveOwnerSettlement(confirmed);
			return {
				ok: true,
				data: confirmed,
				errors: [],
				warnings: [],
				metadata: { action: "settlement.payment.confirmed" }
			};
		}
		reopenEnergyCreditsOwnerSettlementPayment(settlementId, reason, options = {}) {
			if (!reason || typeof reason !== "string" || !reason.trim()) return {
				ok: false,
				data: null,
				errors: [{
					code: "REOPEN_REASON_REQUIRED",
					message: "Motivo de reabertura é obrigatório",
					field: "reason",
					metadata: {}
				}],
				warnings: [],
				metadata: {}
			};
			let settlement = options.settlement || null;
			if (!settlement && options.persist) {
				const loaded = (options.repository || energyCreditsRepository).getOwnerSettlement(settlementId);
				if (!loaded.ok || !loaded.data) return {
					ok: false,
					data: null,
					errors: [{
						code: "SETTLEMENT_NOT_FOUND",
						message: `Repasse ${settlementId} não encontrado`,
						field: "settlementId",
						metadata: {}
					}],
					warnings: [],
					metadata: {}
				};
				settlement = loaded.data;
			}
			if (!settlement) return {
				ok: false,
				data: null,
				errors: [{
					code: "SETTLEMENT_NOT_FOUND",
					message: `Repasse ${settlementId} não encontrado. Forneça options.settlement para modo preview.`,
					field: "settlementId",
					metadata: {}
				}],
				warnings: [],
				metadata: {}
			};
			const reopened = Object.assign({}, settlement, {
				paymentStatus: "open",
				paidAt: null,
				paidAmount: null,
				paymentNotes: null,
				paymentMethod: null,
				reopenReason: reason.trim()
			});
			if (options.persist) (options.repository || energyCreditsRepository).saveOwnerSettlement(reopened);
			return {
				ok: true,
				data: reopened,
				errors: [],
				warnings: [],
				metadata: { action: "settlement.payment.reopened" }
			};
		}
		getEnergyCreditsCsvTemplate(importType, options = {}) {
			return energyCreditsCsvTemplateService.getTemplate(importType, options);
		}
		getEnergyCreditsBeneficiaryConsumptionAverage(beneficiaryUnitId, filters = {}, options = {}) {
			return energyCreditsQueryService.getBeneficiaryConsumptionAverage(beneficiaryUnitId, filters, options).toJSON();
		}
		getEnergyCreditsBeneficiaryMonthlyDataSources(beneficiaryUnitId, referenceMonth, options = {}) {
			this._ensureUtilityBillServices();
			const historyResult = energyCreditsQueryService.getBeneficiaryMonthlyHistory(beneficiaryUnitId, referenceMonth ? { referenceMonth } : {}, options).toJSON();
			const importsResult = this._utilityBillQueryService.searchUtilityBillImports({
				beneficiaryUnitId,
				referenceMonth
			});
			const monthlyRecords = Array.isArray(historyResult.data) ? historyResult.data : [];
			const utilityBillImports = importsResult.ok && Array.isArray(importsResult.data) ? importsResult.data : [];
			return {
				data: {
					monthlyRecords,
					utilityBillImports
				},
				metadata: {
					beneficiaryUnitId,
					referenceMonth,
					monthlyRecordCount: monthlyRecords.length,
					utilityBillImportCount: utilityBillImports.length
				},
				generatedAt: options.referenceDate || null
			};
		}
		getEnergyCreditsUIProvider(options = {}) {
			return new EnergyCreditsUIProvider(this);
		}
	};
	var ESA = new ESAApplication();
	//#endregion
	//#region bootstrap/sessionResolver.ts
	function parseSession(raw) {
		if (!raw) return null;
		try {
			const token = JSON.parse(raw)?.sessionToken;
			if (!token || typeof token !== "string") return null;
			return token;
		} catch {
			return null;
		}
	}
	function resolveSessionToken() {
		try {
			const ss = parseSession(sessionStorage.getItem("esa_session"));
			if (ss) return ss;
			return parseSession(localStorage.getItem("esa_remember"));
		} catch {
			return null;
		}
	}
	//#endregion
	//#region bootstrap/httpFirebaseClient.ts
	var ENDPOINT = "/.netlify/functions/energy-credits-data";
	async function callEndpoint(body) {
		let response;
		try {
			response = await fetch(ENDPOINT, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body)
			});
		} catch (networkErr) {
			throw new Error(`[ESA] Sem conexão com o servidor: ${networkErr.message}`);
		}
		const json = await response.json().catch(() => ({
			ok: false,
			error: `HTTP ${response.status}`
		}));
		if (!response.ok) throw new Error(`[ESA] Erro do servidor (${response.status}): ${json.error ?? "erro desconhecido"}`);
		return json;
	}
	function createHttpFirebaseClient(sessionToken) {
		return {
			async get(path) {
				return (await callEndpoint({
					sessionToken,
					operation: "get",
					path
				})).data ?? null;
			},
			async set(path, value) {
				const result = await callEndpoint({
					sessionToken,
					operation: "set",
					path,
					value
				});
				if (!result.ok) throw new Error(`[ESA] Falha na escrita (${path}): ${result.error ?? "erro desconhecido"}`);
			}
		};
	}
	async function loadEnergyCreditsSnapshot(sessionToken) {
		const result = await callEndpoint({
			sessionToken,
			operation: "snapshot"
		});
		if (!result.ok) throw new Error(`[ESA] Falha ao carregar snapshot: ${result.error ?? "erro desconhecido"}`);
		return result.data ?? {};
	}
	//#endregion
	//#region bootstrap/persistentUiProvider.ts
	function backendError(op) {
		return {
			ok: false,
			errors: [{
				code: "BACKEND_UNAVAILABLE",
				message: `Falha ao salvar no servidor (${op}). Tente novamente.`
			}]
		};
	}
	function syncStores(collection, entity, memoryRepo, esa) {
		if (collection === "generatingUnits") {
			memoryRepo.saveGeneratingUnit(entity);
			esa.hydrateEnergyCreditsReadModel({ generatingUnits: [entity] }, { replace: false });
		} else {
			memoryRepo.saveBeneficiaryUnit(entity);
			esa.hydrateEnergyCreditsReadModel({ beneficiaryUnits: [entity] }, { replace: false });
		}
	}
	function writeAuditLog(firebaseRepo, targetType, targetId, action, uid) {
		const createdAt = (/* @__PURE__ */ new Date()).toISOString();
		const id = `${targetType}::${targetId}::${action}::${createdAt}`;
		firebaseRepo.appendCreditAuditLog({
			id,
			targetType,
			targetId,
			action,
			userId: uid,
			organizationId: uid,
			createdAt
		}).catch(() => {});
	}
	function loadFromMemory(memoryRepo, collection, id) {
		const result = collection === "generatingUnits" ? memoryRepo.getGeneratingUnit(id) : memoryRepo.getBeneficiaryUnit(id);
		return result?.ok && result.data ? result.data : null;
	}
	function createPersistentUiProvider(inner, firebaseRepo, memoryRepo, esa, uid) {
		async function createUnit(collection, innerMethod, saveMethod, targetType, input) {
			const id = typeof input.id === "string" && input.id ? input.id : crypto.randomUUID();
			const withId = {
				...input,
				id
			};
			const domainResult = inner[innerMethod](withId);
			if (!domainResult?.ok) return domainResult ?? {
				ok: false,
				errors: [{
					code: "DOMAIN_VALIDATION",
					message: "Validação de domínio falhou"
				}]
			};
			const entity = domainResult.data;
			if (!(await firebaseRepo[saveMethod](entity)).ok) return backendError(innerMethod);
			syncStores(collection, entity, memoryRepo, esa);
			writeAuditLog(firebaseRepo, targetType, id, "create", uid);
			return {
				ok: true,
				data: entity
			};
		}
		async function updateUnit(collection, saveMethod, targetType, id, patch) {
			const existing = loadFromMemory(memoryRepo, collection, id);
			if (!existing) return {
				ok: false,
				errors: [{
					code: collection === "generatingUnits" ? "GU_NOT_FOUND" : "UB_NOT_FOUND",
					message: `${collection === "generatingUnits" ? "UG" : "UB"} ${id} não encontrada`
				}]
			};
			const updated = {
				...existing,
				...patch,
				id,
				updatedAt: (/* @__PURE__ */ new Date()).toISOString()
			};
			if (!(await firebaseRepo[saveMethod](updated)).ok) return backendError(`update ${collection}`);
			syncStores(collection, updated, memoryRepo, esa);
			writeAuditLog(firebaseRepo, targetType, id, "update", uid);
			return {
				ok: true,
				data: updated
			};
		}
		const WRITE_METHODS = {
			createGeneratingUnit: (input) => createUnit("generatingUnits", "createGeneratingUnit", "saveGeneratingUnit", "generatingUnit", input),
			updateGeneratingUnit: (id, patch) => updateUnit("generatingUnits", "saveGeneratingUnit", "generatingUnit", id, patch),
			createBeneficiaryUnit: (input) => createUnit("beneficiaryUnits", "createBeneficiaryUnit", "saveBeneficiaryUnit", "beneficiaryUnit", input),
			updateBeneficiaryUnit: (id, patch) => updateUnit("beneficiaryUnits", "saveBeneficiaryUnit", "beneficiaryUnit", id, patch)
		};
		return new Proxy({}, { get(_t, prop) {
			if (Object.prototype.hasOwnProperty.call(WRITE_METHODS, prop)) return WRITE_METHODS[prop];
			const val = inner[prop];
			return typeof val === "function" ? val.bind(inner) : val;
		} });
	}
	//#endregion
	//#region bootstrap/standaloneProviderBootstrap.ts
	function decodeUidFromToken(token) {
		try {
			const lastDot = token.lastIndexOf(".");
			if (lastDot <= 0) return null;
			const body = token.slice(0, lastDot);
			const padded = body + "==".slice(0, (4 - body.length % 4) % 4);
			const json = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
			const payload = JSON.parse(json);
			if (typeof payload.uid !== "string" || !payload.uid) return null;
			if (payload.exp && Math.floor(Date.now() / 1e3) > payload.exp) return null;
			return payload.uid;
		} catch {
			return null;
		}
	}
	function dispatchProviderError(code, reason) {
		window.__ESA_UI_PROVIDER_STATUS__ = {
			status: "error",
			reason: code
		};
		window.__ESA_UI_PROVIDER_ERROR__ = {
			code,
			message: reason
		};
		window.dispatchEvent(new CustomEvent("esa:ui-provider:error", { detail: { code } }));
	}
	(function bootstrapStandaloneProvider() {
		(async () => {
			try {
				const sessionToken = resolveSessionToken();
				if (!sessionToken) {
					dispatchProviderError("no_session", "Sessão não encontrada. Faça login para acessar o painel.");
					console.warn("[ESA Standalone] no_session");
					return;
				}
				const uid = decodeUidFromToken(sessionToken);
				if (!uid) {
					dispatchProviderError("invalid_session", "Token de sessão inválido ou expirado.");
					console.warn("[ESA Standalone] invalid_session");
					return;
				}
				ESA.initialize();
				window.ESA_OS = ESA;
				const httpClient = createHttpFirebaseClient(sessionToken);
				const snapshot = await loadEnergyCreditsSnapshot(sessionToken);
				const memoryRepo = ESA.getEnergyCreditsRepository();
				memoryRepo.hydrateFromSnapshot(snapshot);
				ESA.hydrateEnergyCreditsReadModel(snapshot, { replace: true });
				const firebaseRepo = ESA.createEnergyCreditsFirebaseRepository(httpClient);
				const provider = createPersistentUiProvider(new EnergyCreditsUIProvider(ESA), firebaseRepo, memoryRepo, ESA, uid);
				window.__ESA_UI_PROVIDER__ = provider;
				window.__ESA_UI_PROVIDER_STATUS__ = { status: "ready" };
				window.dispatchEvent(new CustomEvent("esa:ui-provider:ready", { detail: {
					source: "standalone-bootstrap",
					uid
				} }));
				console.info("[ESA Standalone] provider_initialized");
			} catch (err) {
				dispatchProviderError("bootstrap_failed", err instanceof Error ? err.message.slice(0, 200) : "unknown");
				console.error("[ESA Standalone] bootstrap_failed");
			}
		})();
	})();
	//#endregion
})();
