const sample = document.querySelector('#sound-sample');
const audio = sample.nextElementSibling;
const video = document.querySelector('#trailer video');

sample.hidden = false;
sample.labels[0].hidden = false;
sample.addEventListener('change', () => {
  audio.src = sample.value;
});
audio.addEventListener('play', () => video.pause());
video.addEventListener('play', () => audio.pause());
