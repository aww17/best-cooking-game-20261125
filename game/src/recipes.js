// Dishes: what a ticket asks for and whether a plate matches it. Matching is an exact
// multiset compare done in one direction only (plate -> recipe): a plate with more of an
// ingredient than the recipe wants is never that recipe, so no count leaks past its
// required number and a wrong stack can never serve a right order.
import { RECIPES, ticketWant } from './config.js';

export const DISHES = RECIPES;

/** How many of one ingredient a recipe needs. */
export function needCount(recipe, ingredient) {
  return recipe.requires[ingredient] ?? 0;
}

/** True when the plate holds exactly the recipe's ingredients, any order. */
export function plateMatches(recipe, plate) {
  const counts = Object.create(null);
  for (const id of plate) counts[id] = (counts[id] ?? 0) + 1;
  let left = plate.length;
  for (const id of Object.keys(recipe.requires)) {
    const want = recipe.requires[id];
    if ((counts[id] ?? 0) !== want) return false;
    left -= want;
  }
  return left === 0;
}

/** The order among `orders` the plate serves, or null: the first whose recipe it matches exactly. */
export function findMatch(orders, plate) {
  for (const order of orders) {
    if (order.expired === true) continue;
    if (plateMatches(order.recipe, plate)) return order;
  }
  return null;
}
