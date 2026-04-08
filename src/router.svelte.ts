let currentRoute = $state(window.location.hash.slice(1) || "vector-map");

function handleHashChange() {
  currentRoute = window.location.hash.slice(1) || "vector-map";
}

window.addEventListener("hashchange", handleHashChange);

export function getRoute() {
  return currentRoute;
}

export function navigate(route: string) {
  window.location.hash = route;
}
