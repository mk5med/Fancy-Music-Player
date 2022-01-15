/**
 * A wrapper around the document.querySelector API. 
 * Used for shorter DOM lookup calls.
 * 
 * @param query Any query for the HTML DOM
 * @returns An element from the DOM or undefined
 */
export const $: (query: string) => HTMLElement | null = q => document.querySelector(q)