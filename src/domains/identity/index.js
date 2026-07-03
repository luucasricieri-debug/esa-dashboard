/**
 * ESA OS — Identity Domain
 * Public API (Barrel Export)
 *
 * Ponto de entrada único do domínio Identity.
 * Consumidores externos devem importar exclusivamente deste arquivo.
 *
 * Uso:
 *   import { Person, Role, ROLES, PERMISSIONS, Session, Organization } from '@/domains/identity';
 *
 * Responsabilidades:
 * - Re-exportar todas as classes públicas do domínio
 * - Re-exportar todos os catálogos (ROLES, PERMISSIONS)
 * - Manter a API pública estável enquanto os internals evoluem
 * - Não conter lógica de negócio — apenas exports
 *
 * IMPORTANTE:
 * Este arquivo NÃO está conectado ao Dashboard legado (index.html).
 * Nenhum código do index.html importa ou depende deste módulo.
 *
 * TODO: Adicionar exports de repositórios quando a camada de persistência for implementada
 * TODO: Adicionar exports de eventos do domínio (DomainEvent) quando CQRS for adotado
 * TODO: Versionar a API pública com CHANGELOG ao estabilizar
 */

export { Permission, PERMISSIONS }   from './permission.js';
export { Role, ROLES, getRoleById }  from './role.js';
export { Person }                    from './person.js';
export { Session }                   from './session.js';
export { Organization, ESA_ORGANIZATION } from './organization.js';
