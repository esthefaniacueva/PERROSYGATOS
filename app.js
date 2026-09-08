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
let tipoModelo = null;
let imagenBase64 = null;
let streamCamara = null;
const RUTA_MODELO = "modelo_tfjs/model.json";

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
        modelo = await tf.loadLayersModel(RUTA_MODELO);
        tipoModelo = "keras";
        estado.textContent = "Modelo listo";
        btnClasificar.disabled = false;
        console.log("Modelo cargado correctamente");
    } catch (error) {
        console.warn("No se pudo cargar el modelo Keras; se usará MobileNet:", error);
        try {
            modelo = await mobilenet.load();
            tipoModelo = "mobilenet";
            estado.textContent = "Modelo listo";
            btnClasificar.disabled = false;
            console.log("Modelo alternativo cargado correctamente");
        } catch (errorAlternativo) {
            console.error("Error al cargar los modelos:", errorAlternativo);
            estado.textContent = "No se pudo cargar el modelo. Comprueba tu conexión e inténtalo de nuevo.";
            mostrarError("Error al cargar el modelo");
            btnClasificar.disabled = true;
        }
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

        if (!vistaPrevia.complete || !vistaPrevia.naturalWidth) {
            throw new Error("La imagen aún no está lista para analizar");
        }

        if (tipoModelo === "keras") {
            const tensorImagen = tf.browser.fromPixels(vistaPrevia)
                .resizeBilinear([224, 224])
                .expandDims(0);
            const salida = modelo.predict(tensorImagen);
            const probabilidadPerro = (await salida.data())[0];
            const confianza = Math.max(probabilidadPerro, 1 - probabilidadPerro);

            tensorImagen.dispose();
            salida.dispose();

            resultado.textContent = confianza < 0.7
                ? "No es un perro ni es un gato"
                : probabilidadPerro >= 0.5 ? "Es un perro" : "Es un gato";
            return;
        }

        const prediccion = await modelo.classify(vistaPrevia, 10);
        const etiquetaPrincipal = prediccion[0].className.toLowerCase();
        const esGato = ["cat", "kitten", "tabby", "siamese", "persian", "egyptian", "tiger cat", "lynx", "feline", "orange cat", "domestic cat", "marmalade cat", "hairless cat", "wildcat", "kitty", "cougar"]
            .some((palabra) => etiquetaPrincipal.includes(palabra));
        const esPerro = ["dog", "puppy", "hound", "terrier", "bulldog", "beagle", "spaniel", "shepherd", "boxer", "retriever", "poodle", "doberman", "mastiff", "pit bull", "collie", "corgi", "chihuahua", "husky", "labrador", "akita", "samoyed", "dalmatian", "wolfhound", "jack russell", "yorkie", "german shepherd", "golden retriever", "pinscher", "miniature pinscher", "affenpinscher", "toy terrier", "mexican hairless", "black-and-tan coonhound", "brabancon griffon", "maltese dog", "papillon"]
            .some((palabra) => etiquetaPrincipal.includes(palabra));

        resultado.textContent = esPerro
            ? "Es un perro"
            : esGato ? "Es un gato" : "No es un perro ni es un gato";
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