/**
 * Limites du service gratuit — source unique, partagée par le serveur
 * (application réelle) et par la page « Soutenir » (transparence).
 * GuardVibe est 100 % gratuit : ces quotas ne servent pas à gagner de
 * l'argent, ils bornent le coût de chaque audit pour que le service reste
 * stable et disponible à long terme.
 */

/** Audits maximum par IP dans une fenêtre glissante de 60 s. */
export const AUDITS_PER_MINUTE = 6;

/** Audits maximum par IP et par jour (fenêtre calendaire UTC, reset à minuit UTC). */
export const AUDITS_PER_DAY = 30;

/**
 * Plafond global journalier, toutes IP confondues. Protège le quota GitHub
 * du serveur (≈ 2 appels API/audit) et la capacité d'hébergement gratuite.
 */
export const GLOBAL_DAILY_AUDITS = 1000;

/** Audits exécutés simultanément par instance (garde-fou mémoire/CPU). */
export const MAX_CONCURRENT_AUDITS = 3;

/** Nombre maximum de fichiers analysés par audit. */
export const MAX_AUDIT_FILES = 200;
