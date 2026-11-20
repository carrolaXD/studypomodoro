const film = document.querySelector("video");
let chapter = 0;
film.addEventListener("loadedmetadata", () => {
  if (chapter) film.currentTime = chapter;
});
for (const button of document.querySelectorAll("button[data-start]")) {
  button.hidden = false;
  button.addEventListener("click", () => {
    chapter = Number(button.dataset.start);
    if (film.readyState >= 1) film.currentTime = chapter;
    film.focus();
    film.play().catch(() => film.focus());
  });
}
