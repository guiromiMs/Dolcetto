 
 
 /*codigo para el contador de productos*/
 const contador = document.getElementById("contador");
const btnSumar = document.getElementById("sumar");
const btnRestar = document.getElementById("restar");

if (contador && btnSumar && btnRestar) {
  let numero = 0;

  btnSumar.addEventListener("click", () => {
    numero++;
    contador.textContent = numero;
  });

  btnRestar.addEventListener("click", () => {
    if (numero > 0) {
      numero--;
      contador.textContent = numero;
    }
  });
}
