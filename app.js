const inputImagenGaleria = document.getElementById("imagenGaleria");
const inputImagenCamara = document.getElementById("imagenCamara");
const vistaPrevia = document.getElementById("vistaPrevia");
const btnClasificar = document.getElementById("btnClasificar");
const btnCamara = document.getElementById("btnCamara");
const btnTomarFoto = document.getElementById("btnTomarFoto");
const btnCerrarCamara = document.getElementById("btnCerrarCamara");
const panelCamara = document.getElementById("panelCamara");
const videoCamara = document.getElementById("videoCamara");
const canvasFoto = document.getElementById("canvasFoto");
const resultado = document.getElementById("resultado");
const estado = document.getElementById("estado");

let modelo = null;
let imagenBase64 = null;
let streamCamara = null;

function abrirCapturaDeRespaldo() {
    cerrarCamara();
    inputImagenCamara.click();
}

function mostrarError(mensaje) {
    resultado.textContent = mensaje;
    resultado.style.color = "#b42318";
}

function limpiarResultado() {
    resultado.style.color = "#111827";
}

function mostrarVistaPreviaDesdeDataURL(dataUrl) {
    imagenBase64 = dataUrl;
    vistaPrevia.src = imagenBase64;
    vistaPrevia.style.display = "block";
    limpiarResultado();
    resultado.textContent = "Listo para clasificar";
}

function actualizarVistaPrevia(file) {
    if (!file) return;

    const lector = new FileReader();
    lector.onload = (evento) => {
        mostrarVistaPreviaDesdeDataURL(evento.target.result);
    };
    lector.readAsDataURL(file);
}

async function iniciarCamara() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        abrirCapturaDeRespaldo();
        return;
    }

    try {
        panelCamara.classList.remove("oculto");
        streamCamara = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });

        videoCamara.srcObject = streamCamara;
        videoCamara.play();
    } catch (error) {
        console.error("No se pudo abrir la cámara:", error);
        abrirCapturaDeRespaldo();
    }
}

function cerrarCamara() {
    if (streamCamara) {
        streamCamara.getTracks().forEach((track) => track.stop());
        streamCamara = null;
    }

    if (videoCamara.srcObject) {
        videoCamara.srcObject.getTracks().forEach((track) => track.stop());
        videoCamara.srcObject = null;
    }

    panelCamara.classList.add("oculto");
}

function tomarFoto() {
    if (!videoCamara.videoWidth || !videoCamara.videoHeight) {
        mostrarError("La cámara aún no está lista");
        return;
    }

    canvasFoto.width = videoCamara.videoWidth;
    canvasFoto.height = videoCamara.videoHeight;
    const contexto = canvasFoto.getContext("2d");
    contexto.drawImage(videoCamara, 0, 0, canvasFoto.width, canvasFoto.height);

    const foto = canvasFoto.toDataURL("image/png");
    mostrarVistaPreviaDesdeDataURL(foto);
    cerrarCamara();
}

function obtenerDecision(etiqueta) {
    const textoEtiqueta = etiqueta.toLowerCase();
    const palabrasGato = [
        "cat", "kitten", "tabby", "siamese", "persian", "egyptian", "tiger cat",
        "lynx", "feline", "orange cat", "domestic cat"
    ];
    const palabrasPerro = [
        "dog", "puppy", "hound", "terrier", "bulldog", "beagle", "spaniel",
        "shepherd", "boxer", "retriever", "poodle", "doberman", "mastiff", "pit bull",
        "collie", "corgi", "chihuahua", "husky", "labrador", "akita", "samoyed",
        "dalmatian", "wolfhound", "jack russell", "yorkie", "german shepherd", "golden retriever"
    ];

    const tieneGato = palabrasGato.some((palabra) => textoEtiqueta.includes(palabra));
    const tienePerro = palabrasPerro.some((palabra) => textoEtiqueta.includes(palabra));

    if (tieneGato && !tienePerro) return "Es un gato";
    if (tienePerro && !tieneGato) return "Es un perro";
    if (textoEtiqueta.includes("gato")) return "Es un gato";
    if (textoEtiqueta.includes("perro")) return "Es un perro";
    return "No es un perro ni es un gato";
}

async function cargarModelo() {
    try {
        estado.textContent = "Cargando modelo...";
        modelo = await mobilenet.load();
        estado.textContent = "Modelo listo";
        btnClasificar.disabled = false;
        console.log("Modelo cargado correctamente");
    } catch (error) {
        console.error("Error al cargar el modelo:", error);
        estado.textContent = "No se pudo cargar el modelo. Comprueba tu conexión e inténtalo de nuevo.";
        mostrarError("Error al cargar el modelo");
        btnClasificar.disabled = true;
    }
}

async function clasificarImagen() {
    if (!imagenBase64) {
        mostrarError("Primero selecciona una imagen");
        return;
    }

    if (!modelo) {
        mostrarError("El modelo aún no está listo");
        return;
    }

    try {
        limpiarResultado();
        resultado.textContent = "Analizando imagen...";
        btnClasificar.disabled = true;

        const imagen = new Image();
        imagen.src = imagenBase64;
        await imagen.decode();

        const prediccion = await modelo.classify(imagen, 10);

        let mejorGato = 0;
        let mejorPerro = 0;

        prediccion.slice(0, 5).forEach((item) => {
            const nombre = item.className.toLowerCase();
            const p = item.probability;

            if (["cat", "kitten", "tabby", "siamese", "persian", "egyptian", "tiger cat", "lynx", "feline", "orange cat", "domestic cat"].some((palabra) => nombre.includes(palabra))) {
                mejorGato = Math.max(mejorGato, p);
            }

            if (["dog", "puppy", "hound", "terrier", "bulldog", "beagle", "spaniel", "shepherd", "boxer", "retriever", "poodle", "doberman", "mastiff", "pit bull", "collie", "corgi", "chihuahua", "husky", "labrador", "akita", "samoyed", "dalmatian", "wolfhound", "jack russell", "yorkie", "german shepherd", "golden retriever"].some((palabra) => nombre.includes(palabra))) {
                mejorPerro = Math.max(mejorPerro, p);
            }
        });

        const umbralMascota = 0.08;
        const margenDecision = 1.05;

        if (mejorPerro >= umbralMascota && mejorPerro > mejorGato * margenDecision) {
            resultado.textContent = "Es un perro";
            return;
        }

        if (mejorGato >= umbralMascota && mejorGato > mejorPerro * margenDecision) {
            resultado.textContent = "Es un gato";
            return;
        }

        resultado.textContent = "No es un perro ni es un gato";
    } catch (error) {
        console.error("Error al clasificar:", error);
        mostrarError("No se pudo clasificar la imagen");
    } finally {
        btnClasificar.disabled = false;
    }
}

function procesarImagenSeleccionada(evento) {
    const archivo = evento.target.files[0];
    if (!archivo) return;
    actualizarVistaPrevia(archivo);
    evento.target.value = "";
}

inputImagenGaleria.addEventListener("change", procesarImagenSeleccionada);
inputImagenCamara.addEventListener("change", procesarImagenSeleccionada);

btnCamara.addEventListener("click", iniciarCamara);
btnTomarFoto.addEventListener("click", tomarFoto);
btnCerrarCamara.addEventListener("click", cerrarCamara);
btnClasificar.addEventListener("click", clasificarImagen);

if (inputImagenGaleria) {
    inputImagenGaleria.addEventListener("click", () => {
        inputImagenGaleria.value = "";
    });
}

if (inputImagenCamara) {
    inputImagenCamara.addEventListener("click", () => {
        inputImagenCamara.value = "";
    });
}

cargarModelo();