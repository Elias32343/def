// URLs de las bases de datos
const URL_PERSONAS = 'https://docs.google.com/spreadsheets/d/1GU1oKIb9E0Vvwye6zRB2F_fT2jGzRvJ0WoLtWKuio-E/gviz/tq?tqx=out:json&gid=1744634045';
const URL_HISTORIAL = 'https://docs.google.com/spreadsheets/d/1ohT8rfNsG4h7JjPZllHoyrxePutKsv2Q-5mBeUozia0/gviz/tq?tqx=out:json&gid=1185155654';

// URL del Google Form para registrar movimientos
const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfe3gplfkjNe3qEjC5l_Jqhsrk_zPSdQM_Wg0M6BUhoHtj9tg/formResponse';

// IMPORTANTE: Debes obtener estos entry IDs inspeccionando tu formulario
// Para obtenerlos: abre el formulario, haz clic derecho en cada campo, selecciona "Inspeccionar elemento"
// y busca el atributo "name" que contiene algo como "entry.123456789"
const FORM_ENTRIES = {
    equipo: 'entry.1834514522',           // Campo "Equipo" - REEMPLAZAR CON EL ID REAL
    nombreCompleto: 'entry.1486223911',   // Campo "Nombre Completo" - REEMPLAZAR CON EL ID REAL
    documento: 'entry.1695051506',        // Campo "Documento" - REEMPLAZAR CON EL ID REAL
    curso: 'entry.564849635',            // Campo "Curso" - REEMPLAZAR CON EL ID REAL
    telefono: 'entry.414930075',         // Campo "Teléfono" - REEMPLAZAR CON EL ID REAL
    profesorEncargado: 'entry.116949605', // Campo "Profesor Encargado" - REEMPLAZAR CON EL ID REAL
    materia: 'entry.1714096158',          // Campo "Materia" - REEMPLAZAR CON EL ID REAL
    tipo: 'entry.801360829',             // Campo "Tipo" - REEMPLAZAR CON EL ID REAL
    comentario: 'entry.43776270'        // Campo "Comentario" - REEMPLAZAR CON EL ID REAL
};

// Variables globales
let personas = [];
let historial = [];
let equipoSeleccionado = null;

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', function() {
    crearMallaEquipos();
    cargarDatos();
    // Sincronización cada 30 segundos para mantener datos actualizados
    setInterval(() => {
        cargarDatos();
    }, 30000);
});

// Crear la malla de 40 equipos
function crearMallaEquipos() {
    const malla = document.getElementById('malla');
    malla.innerHTML = '';
    
    for (let i = 1; i <= 40; i++) {
        const equipo = document.createElement('div');
        equipo.className = 'ramo';
        equipo.dataset.equipo = i;
        equipo.onclick = () => abrirModalEquipo(i);
        
        const numero = document.createElement('div');
        numero.textContent = `Equipo ${i}`;
        numero.style.fontWeight = 'bold';
        
        const estado = document.createElement('div');
        estado.textContent = 'Disponible';
        estado.className = 'estado-equipo';
        estado.style.fontSize = '0.9em';
        estado.style.marginTop = '5px';
        
        equipo.appendChild(numero);
        equipo.appendChild(estado);
        
        malla.appendChild(equipo);
    }
}

// Cargar datos de las bases de datos
async function cargarDatos() {
    try {
        await Promise.all([
            cargarPersonas(),
            cargarHistorial()
        ]);
        actualizarEstadoEquipos();
    } catch (error) {
        console.error('Error cargando datos:', error);
        mostrarEstadoSync('Error sincronizando datos', 'error');
    }
}

// Cargar base de datos de personas - CORREGIDO
async function cargarPersonas() {
    try {
        const response = await fetch(URL_PERSONAS);
        const text = await response.text();
        const jsonData = JSON.parse(text.substring(47).slice(0, -2));
        
        // CORRECCIÓN: El mapeo de columnas estaba mal
        // Según tu descripción:
        // columna 0 (a): Marca temporal
        // columna 1 (b): Nombre Completo  
        // columna 2 (c): Documento
        // columna 3 (d): Curso (aunque dijiste columna c, debe ser d)
        // columna 4 (e): Teléfono (aunque dijiste columna d, debe ser e)
        
        personas = jsonData.table.rows.slice(1).map(row => {
            const persona = {
                nombreCompleto: row.c[1] ? row.c[1].v : '',
                documento: row.c[2] ? row.c[2].v.toString().trim() : '', // Agregado trim()
                curso: row.c[3] ? row.c[3].v : '',
                telefono: row.c[4] ? row.c[4].v.toString().trim() : '' // Agregado trim()
            };
            
            // Debug: mostrar en consola para verificar
            console.log('Persona cargada:', persona);
            return persona;
        }).filter(p => p.documento && p.documento.length > 0); // Filtrar registros sin documento
        
        console.log('Total personas cargadas:', personas.length);
        console.log('Documentos disponibles:', personas.map(p => p.documento));
        
    } catch (error) {
        console.error('Error cargando personas:', error);
        throw error;
    }
}

// Cargar historial de préstamos
async function cargarHistorial() {
    try {
        const response = await fetch(URL_HISTORIAL);
        const text = await response.text();
        const jsonData = JSON.parse(text.substring(47).slice(0, -2));
        
        historial = jsonData.table.rows.slice(1).map(row => ({
            marcaTemporal: row.c[0] ? new Date(row.c[0].v) : new Date(),
            equipo: row.c[1] ? row.c[1].v.toString() : '',
            nombreCompleto: row.c[2] ? row.c[2].v : '',
            documento: row.c[3] ? row.c[3].v.toString().trim() : '', // Agregado trim()
            curso: row.c[4] ? row.c[4].v : '',
            telefono: row.c[5] ? row.c[5].v.toString().trim() : '', // Agregado trim()
            profesorEncargado: row.c[6] ? row.c[6].v : '',
            materia: row.c[7] ? row.c[7].v : '',
            tipo: row.c[8] ? row.c[8].v : '',
            comentario: row.c[9] ? row.c[9].v : ''
        })).filter(h => h.equipo).sort((a, b) => b.marcaTemporal - a.marcaTemporal);
        
        console.log('Historial cargado:', historial.length, 'registros');
    } catch (error) {
        console.error('Error cargando historial:', error);
        throw error;
    }
}

// Actualizar estado visual de los equipos
function actualizarEstadoEquipos() {
    for (let i = 1; i <= 40; i++) {
        const elemento = document.querySelector(`[data-equipo="${i}"]`);
        const estadoEquipo = obtenerEstadoEquipo(i.toString());
        const estadoElemento = elemento.querySelector('.estado-equipo');
        
        elemento.classList.remove('equipo-prestado', 'equipo-disponible');
        
        if (estadoEquipo.prestado) {
            elemento.classList.add('equipo-prestado');
            elemento.style.backgroundColor = '#d4edda';
            elemento.style.borderColor = '#28a745';
            elemento.style.color = '#155724';
            estadoElemento.textContent = `Prestado a: ${estadoEquipo.nombreCompleto}`;
        } else {
            elemento.classList.add('equipo-disponible');
            elemento.style.backgroundColor = '#f8f9fa';
            elemento.style.borderColor = '#dee2e6';
            elemento.style.color = '#495057';
            estadoElemento.textContent = 'Disponible';
        }
    }
}

// Obtener estado actual de un equipo específico
function obtenerEstadoEquipo(numeroEquipo) {
    const movimientosEquipo = historial.filter(h => h.equipo === numeroEquipo);
    
    if (movimientosEquipo.length === 0) {
        return { prestado: false };
    }
    
    const ultimoMovimiento = movimientosEquipo[0]; // Más reciente
    
    return {
        prestado: ultimoMovimiento.tipo === 'Préstamo',
        ultimoMovimiento: ultimoMovimiento,
        nombreCompleto: ultimoMovimiento.nombreCompleto
    };
}

// Abrir modal para equipo seleccionado
function abrirModalEquipo(numeroEquipo) {
    equipoSeleccionado = numeroEquipo;
    const estadoEquipo = obtenerEstadoEquipo(numeroEquipo.toString());
    
    const modal = document.getElementById('modalMetodos');
    const header = modal.querySelector('.modal-header h2');
    
    header.textContent = `Equipo ${numeroEquipo}`;
    
    if (estadoEquipo.prestado) {
        mostrarModalDevolucion(estadoEquipo.ultimoMovimiento);
    } else {
        mostrarModalPrestamo();
    }
    
    modal.style.display = 'block';
}

// Mostrar formulario de préstamo
function mostrarModalPrestamo() {
    const listaMetodos = document.getElementById('listaMetodos');
    listaMetodos.innerHTML = `
        <div class="formulario-prestamo" style="padding: 20px;">
            <div style="margin-bottom: 15px;">
                <label for="documento" style="display: block; margin-bottom: 5px; font-weight: bold;">Documento:</label>
                <input type="text" id="documento" placeholder="Ingrese el número de documento" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" />
                <small id="documento-status" style="display: block; margin-top: 5px; font-size: 0.8em;"></small>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label for="profesor" style="display: block; margin-bottom: 5px; font-weight: bold;">Profesor(a) Encargado:</label>
                <input type="text" id="profesor" placeholder="Nombre del profesor encargado" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" />
            </div>
            
            <div style="margin-bottom: 20px;">
                <label for="asignatura" style="display: block; margin-bottom: 5px; font-weight: bold;">Asignatura:</label>
                <input type="text" id="asignatura" placeholder="Materia o asignatura" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" />
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="btn-registrar" onclick="procesarPrestamo()" style="background-color: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
                    Registrar Préstamo
                </button>
                <button onclick="cerrarModal()" style="background-color: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
                    Cancelar
                </button>
            </div>
        </div>
    `;
    
    // Enfocar el campo de documento y agregar validación en tiempo real
    setTimeout(() => {
        const documentoInput = document.getElementById('documento');
        documentoInput.focus();
        
        // Validación en tiempo real
        documentoInput.addEventListener('input', function() {
            validarDocumentoEnTiempoReal(this.value.trim());
        });
    }, 100);
}

// Nueva función: validar documento en tiempo real
function validarDocumentoEnTiempoReal(documento) {
    const statusElement = document.getElementById('documento-status');
    const btnRegistrar = document.getElementById('btn-registrar');
    
    if (!documento) {
        statusElement.textContent = '';
        statusElement.style.color = '';
        btnRegistrar.disabled = false;
        return;
    }
    
    const persona = personas.find(p => p.documento === documento);
    if (persona) {
        statusElement.textContent = `✓ Documento válido - ${persona.nombreCompleto} (${persona.curso})`;
        statusElement.style.color = '#28a745';
        btnRegistrar.disabled = false;
        btnRegistrar.style.opacity = '1';
    } else {
        statusElement.textContent = '✗ Documento no encontrado en la base de datos';
        statusElement.style.color = '#dc3545';
        btnRegistrar.disabled = true;
        btnRegistrar.style.opacity = '0.6';
    }
}

// Mostrar formulario de devolución
function mostrarModalDevolucion(ultimoMovimiento) {
    const listaMetodos = document.getElementById('listaMetodos');
    listaMetodos.innerHTML = `
        <div style="padding: 20px;">
            <div class="readonly-info" style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin-bottom: 15px;">
                <h4 style="margin-top: 0; color: #495057;">Información del Préstamo:</h4>
                <p style="margin: 8px 0;"><strong>Nombre:</strong> <span class="info-content">${ultimoMovimiento.nombreCompleto}</span></p>
                <p style="margin: 8px 0;"><strong>Documento:</strong> <span class="info-content">${ultimoMovimiento.documento}</span></p>
                <p style="margin: 8px 0;"><strong>Curso:</strong> <span class="info-content">${ultimoMovimiento.curso}</span></p>
                <p style="margin: 8px 0;"><strong>Profesor Encargado:</strong> <span class="info-content">${ultimoMovimiento.profesorEncargado}</span></p>
                <p style="margin: 8px 0;"><strong>Asignatura:</strong> <span class="info-content">${ultimoMovimiento.materia}</span></p>
                <p style="margin: 8px 0;"><strong>Fecha de Préstamo:</strong> <span class="info-content">${ultimoMovimiento.marcaTemporal.toLocaleString()}</span></p>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label for="comentario-devolucion" style="display: block; margin-bottom: 5px; font-weight: bold;">Comentario sobre la devolución (opcional):</label>
                <textarea id="comentario-devolucion" placeholder="Ingrese comentarios sobre el estado del equipo, observaciones, etc..." 
                    style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; min-height: 80px; resize: vertical;"></textarea>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button onclick="procesarDevolucion()" style="background-color: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
                    Registrar Devolución
                </button>
                <button onclick="cerrarModal()" style="background-color: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
                    Cancelar
                </button>
            </div>
        </div>
    `;
}

// Procesar registro de préstamo - MEJORADO
async function procesarPrestamo() {
    const documento = document.getElementById('documento').value.trim();
    const profesor = document.getElementById('profesor').value.trim();
    const asignatura = document.getElementById('asignatura').value.trim();
    
    if (!documento || !profesor || !asignatura) {
        alert('Por favor complete todos los campos requeridos');
        return;
    }
    
    // Validar que el documento exista en la base de personas
    const persona = personas.find(p => p.documento === documento);
    if (!persona) {
        alert(`El documento "${documento}" no está registrado en la base de datos de personas autorizadas.\n\nDocumentos disponibles: ${personas.length > 0 ? personas.map(p => p.documento).join(', ') : 'No hay documentos cargados'}`);
        return;
    }
    
    const registro = {
        equipo: equipoSeleccionado.toString(),
        nombreCompleto: persona.nombreCompleto,
        documento: persona.documento,
        curso: persona.curso,
        telefono: persona.telefono,
        profesorEncargado: profesor,
        materia: asignatura,
        tipo: 'Préstamo',
        comentario: ''
    };
    
    try {
        mostrarEstadoSync('Registrando préstamo...');
        await registrarEnGoogleForm(registro);
        
        // Actualizar el historial local inmediatamente para feedback visual
        const nuevoMovimiento = {
            marcaTemporal: new Date(),
            equipo: registro.equipo,
            nombreCompleto: registro.nombreCompleto,
            documento: registro.documento,
            curso: registro.curso,
            telefono: registro.telefono,
            profesorEncargado: registro.profesorEncargado,
            materia: registro.materia,
            tipo: 'Préstamo',
            comentario: registro.comentario
        };
        
        // Agregar al inicio del historial local
        historial.unshift(nuevoMovimiento);
        
        // Actualizar visualmente los equipos
        actualizarEstadoEquipos();
        
        cerrarModal();
        mostrarEstadoSync('Préstamo registrado correctamente', 'success');
        
        // Recargar datos desde el servidor después para sincronizar
        setTimeout(() => {
            cargarDatos();
        }, 2000);
        
    } catch (error) {
        console.error('Error registrando préstamo:', error);
        mostrarEstadoSync('Error registrando el préstamo', 'error');
        alert('Error registrando el préstamo. Por favor, verifique su conexión e inténtelo nuevamente.');
    }
}

// Procesar registro de devolución
async function procesarDevolucion() {
    const comentario = document.getElementById('comentario-devolucion').value.trim();
    const estadoEquipo = obtenerEstadoEquipo(equipoSeleccionado.toString());
    const ultimoMovimiento = estadoEquipo.ultimoMovimiento;
    
    const registro = {
        equipo: equipoSeleccionado.toString(),
        nombreCompleto: ultimoMovimiento.nombreCompleto,
        documento: ultimoMovimiento.documento,
        curso: ultimoMovimiento.curso,
        telefono: ultimoMovimiento.telefono,
        profesorEncargado: ultimoMovimiento.profesorEncargado,
        materia: ultimoMovimiento.materia,
        tipo: 'Devolución',
        comentario: comentario
    };
    
    try {
        mostrarEstadoSync('Registrando devolución...');
        await registrarEnGoogleForm(registro);
        
        // Actualizar el historial local inmediatamente para feedback visual
        const nuevoMovimiento = {
            marcaTemporal: new Date(),
            equipo: registro.equipo,
            nombreCompleto: registro.nombreCompleto,
            documento: registro.documento,
            curso: registro.curso,
            telefono: registro.telefono,
            profesorEncargado: registro.profesorEncargado,
            materia: registro.materia,
            tipo: 'Devolución',
            comentario: registro.comentario
        };
        
        // Agregar al inicio del historial local
        historial.unshift(nuevoMovimiento);
        
        // Actualizar visualmente los equipos
        actualizarEstadoEquipos();
        
        cerrarModal();
        mostrarEstadoSync('Devolución registrada correctamente', 'success');
        
        // Recargar datos desde el servidor después para sincronizar
        setTimeout(() => {
            cargarDatos();
        }, 2000);
        
    } catch (error) {
        console.error('Error registrando devolución:', error);
        mostrarEstadoSync('Error registrando la devolución', 'error');
        alert('Error registrando la devolución. Por favor, verifique su conexión e inténtelo nuevamente.');
    }
}

// Registrar movimiento en Google Forms
async function registrarEnGoogleForm(registro) {
    const formData = new FormData();
    
    // Añadir todos los campos al formulario
    formData.append(FORM_ENTRIES.equipo, registro.equipo);
    formData.append(FORM_ENTRIES.nombreCompleto, registro.nombreCompleto);
    formData.append(FORM_ENTRIES.documento, registro.documento);
    formData.append(FORM_ENTRIES.curso, registro.curso);
    formData.append(FORM_ENTRIES.telefono, registro.telefono);
    formData.append(FORM_ENTRIES.profesorEncargado, registro.profesorEncargado);
    formData.append(FORM_ENTRIES.materia, registro.materia);
    formData.append(FORM_ENTRIES.tipo, registro.tipo);
    formData.append(FORM_ENTRIES.comentario, registro.comentario || '');
    
    try {
        const response = await fetch(GOOGLE_FORM_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: formData
        });
        
        console.log('Registro enviado exitosamente:', registro);
        return true;
        
    } catch (error) {
        console.error('Error enviando a Google Forms:', error);
        throw new Error('No se pudo registrar el movimiento en la base de datos.');
    }
}

// Cerrar modal
function cerrarModal() {
    const modal = document.getElementById('modalMetodos');
    modal.style.display = 'none';
    equipoSeleccionado = null;
}

// Mostrar estado de sincronización
function mostrarEstadoSync(mensaje, tipo = 'info') {
    const syncStatus = document.getElementById('sync-status');
    if (!syncStatus) return;
    
    syncStatus.textContent = mensaje;
    syncStatus.className = `sync-status ${tipo}`;
    
    if (tipo === 'success') {
        syncStatus.style.color = '#28a745';
    } else if (tipo === 'error') {
        syncStatus.style.color = '#dc3545';
    } else {
        syncStatus.style.color = '#17a2b8';
    }
    
    if (tipo === 'success' || tipo === 'error') {
        setTimeout(() => {
            syncStatus.textContent = '';
            syncStatus.className = 'sync-status';
        }, 5000);
    }
}

// Nueva función de debugging
function debugPersonas() {
    console.log('=== DEBUG DE PERSONAS ===');
    console.log('Total personas:', personas.length);
    console.log('Primeras 5 personas:');
    personas.slice(0, 5).forEach((p, i) => {
        console.log(`${i + 1}. Documento: "${p.documento}", Nombre: "${p.nombreCompleto}"`);
    });
    console.log('Todos los documentos:', personas.map(p => `"${p.documento}"`));
}

// Funciones auxiliares para mejorar la experiencia de usuario
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        cerrarModal();
    }
});

// Cerrar modal al hacer clic fuera de él
window.onclick = function(event) {
    const modal = document.getElementById('modalMetodos');
    if (event.target === modal) {
        cerrarModal();
    }
};

// Actualizar estado cuando la página obtiene el foco
window.addEventListener('focus', function() {
    cargarDatos();
});

// Función auxiliar para resetear todos los equipos (solo para pruebas)
function resetearMalla() {
    if (confirm('¿Está seguro que desea ver todos los equipos como disponibles? (Esto no afecta la base de datos real)')) {
        historial = [];
        actualizarEstadoEquipos();
        mostrarEstadoSync('Vista actualizada - Los datos reales permanecen en la base de datos', 'info');
    }
}

console.log('Sistema de Préstamo de Equipos cargado correctamente');
console.log('IMPORTANTE: Debes actualizar los FORM_ENTRIES con los IDs reales de tu formulario');

// Agregar la función de debug al objeto window para poder llamarla desde la consola
window.debugPersonas = debugPersonas;
