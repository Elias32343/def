// URLs de las bases de datos
const URL_PERSONAS = 'https://docs.google.com/spreadsheets/d/1GU1oKIb9E0Vvwye6zRB2F_fT2jGzRvJ0WoLtWKuio-E/gviz/tq?tqx=out:json&gid=1744634045';
const URL_HISTORIAL = 'https://docs.google.com/spreadsheets/d/1ohT8rfNsG4h7JjPZllHoyrxePutKsv2Q-5mBeUozia0/gviz/tq?tqx=out:json&gid=1185155654';

// URL del Google Form para registrar movimientos
const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfe3gplfkjNe3qEjC5l_Jqhsrk_zPSdQM_Wg0M6BUhoHtj9tg/formResponse';

// IMPORTANTE: Debes obtener estos entry IDs inspeccionando tu formulario
const FORM_ENTRIES = {
    equipo: 'entry.1834514522',
    nombreCompleto: 'entry.1486223911',
    documento: 'entry.1695051506',
    curso: 'entry.564849635',
    telefono: 'entry.414930075',
    profesorEncargado: 'entry.116949605',
    materia: 'entry.1714096158',
    tipo: 'entry.801360829',
    comentario: 'entry.43776270'
};

// Variables globales
let personas = [];
let historial = [];
let equipoSeleccionado = null;

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', function() {
    console.log('Iniciando aplicación...');
    crearMallaEquipos();
    cargarDatos();
    // Sincronización cada 30 segundos
    setInterval(() => {
        cargarDatos();
    }, 30000);
});

// Crear la malla de 40 equipos
function crearMallaEquipos() {
    const malla = document.getElementById('malla');
    if (!malla) {
        console.error('No se encontró el elemento con id "malla"');
        return;
    }
    
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
    console.log('Malla de equipos creada');
}

// Cargar datos de las bases de datos
async function cargarDatos() {
    console.log('Cargando datos...');
    mostrarEstadoSync('Sincronizando datos...');
    
    try {
        await Promise.all([
            cargarPersonas(),
            cargarHistorial()
        ]);
        actualizarEstadoEquipos();
        mostrarEstadoSync('Datos sincronizados correctamente', 'success');
    } catch (error) {
        console.error('Error cargando datos:', error);
        mostrarEstadoSync('Error sincronizando datos', 'error');
    }
}

// Cargar base de datos de personas
async function cargarPersonas() {
    try {
        console.log('Cargando personas desde:', URL_PERSONAS);
        const response = await fetch(URL_PERSONAS);
        const text = await response.text();
        
        // Parsear la respuesta de Google Sheets
        const jsonData = JSON.parse(text.substring(47).slice(0, -2));
        
        if (!jsonData.table || !jsonData.table.rows) {
            throw new Error('Formato de datos inválido en personas');
        }
        
        // Mapear datos (saltando la fila de encabezados)
        personas = jsonData.table.rows.slice(1).map((row, index) => {
            try {
                const persona = {
                    nombreCompleto: row.c[1] && row.c[1].v ? row.c[1].v.toString().trim() : '',
                    documento: row.c[2] && row.c[2].v ? row.c[2].v.toString().trim() : '',
                    curso: row.c[3] && row.c[3].v ? row.c[3].v.toString().trim() : '',
                    telefono: row.c[4] && row.c[4].v ? row.c[4].v.toString().trim() : ''
                };
                
                // Solo retornar si tiene documento
                return persona.documento ? persona : null;
            } catch (err) {
                console.warn(`Error procesando fila ${index + 2} de personas:`, err);
                return null;
            }
        }).filter(p => p !== null);
        
        console.log(`Personas cargadas: ${personas.length}`);
        console.log('Documentos disponibles:', personas.map(p => p.documento).slice(0, 5), '...');
        
    } catch (error) {
        console.error('Error cargando personas:', error);
        personas = []; // Fallback
        throw error;
    }
}

// Cargar historial de préstamos
async function cargarHistorial() {
    try {
        console.log('Cargando historial desde:', URL_HISTORIAL);
        const response = await fetch(URL_HISTORIAL);
        const text = await response.text();
        
        // Parsear la respuesta de Google Sheets
        const jsonData = JSON.parse(text.substring(47).slice(0, -2));
        
        if (!jsonData.table || !jsonData.table.rows) {
            throw new Error('Formato de datos inválido en historial');
        }
        
        // Mapear datos del historial
        historial = jsonData.table.rows.slice(1).map((row, index) => {
            try {
                const registro = {
                    marcaTemporal: row.c[0] && row.c[0].v ? new Date(row.c[0].v) : new Date(),
                    equipo: row.c[1] && row.c[1].v ? row.c[1].v.toString().trim() : '',
                    nombreCompleto: row.c[2] && row.c[2].v ? row.c[2].v.toString().trim() : '',
                    documento: row.c[3] && row.c[3].v ? row.c[3].v.toString().trim() : '',
                    curso: row.c[4] && row.c[4].v ? row.c[4].v.toString().trim() : '',
                    telefono: row.c[5] && row.c[5].v ? row.c[5].v.toString().trim() : '',
                    profesorEncargado: row.c[6] && row.c[6].v ? row.c[6].v.toString().trim() : '',
                    materia: row.c[7] && row.c[7].v ? row.c[7].v.toString().trim() : '',
                    tipo: row.c[8] && row.c[8].v ? row.c[8].v.toString().trim() : '',
                    comentario: row.c[9] && row.c[9].v ? row.c[9].v.toString().trim() : ''
                };
                
                return registro.equipo ? registro : null;
            } catch (err) {
                console.warn(`Error procesando fila ${index + 2} de historial:`, err);
                return null;
            }
        }).filter(h => h !== null)
          .sort((a, b) => b.marcaTemporal - a.marcaTemporal); // Más reciente primero
        
        console.log(`Historial cargado: ${historial.length} registros`);
        
    } catch (error) {
        console.error('Error cargando historial:', error);
        historial = []; // Fallback
        throw error;
    }
}

// Actualizar estado visual de los equipos
function actualizarEstadoEquipos() {
    console.log('Actualizando estado de equipos...');
    
    for (let i = 1; i <= 40; i++) {
        const elemento = document.querySelector(`[data-equipo="${i}"]`);
        if (!elemento) {
            console.warn(`No se encontró elemento para equipo ${i}`);
            continue;
        }
        
        const estadoEquipo = obtenerEstadoEquipo(i.toString());
        const estadoElemento = elemento.querySelector('.estado-equipo');
        
        // Limpiar clases previas
        elemento.classList.remove('equipo-prestado', 'equipo-disponible');
        
        if (estadoEquipo.prestado) {
            elemento.classList.add('equipo-prestado');
            elemento.style.backgroundColor = '#d4edda';
            elemento.style.borderColor = '#28a745';
            elemento.style.color = '#155724';
            
            if (estadoElemento) {
                estadoElemento.textContent = `Prestado a: ${estadoEquipo.nombreCompleto}`;
            }
        } else {
            elemento.classList.add('equipo-disponible');
            elemento.style.backgroundColor = '#f8f9fa';
            elemento.style.borderColor = '#dee2e6';
            elemento.style.color = '#495057';
            
            if (estadoElemento) {
                estadoElemento.textContent = 'Disponible';
            }
        }
    }
    
    console.log('Estado de equipos actualizado');
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
    console.log(`Abriendo modal para equipo ${numeroEquipo}`);
    equipoSeleccionado = numeroEquipo;
    const estadoEquipo = obtenerEstadoEquipo(numeroEquipo.toString());
    
    const modal = document.getElementById('modalMetodos');
    if (!modal) {
        console.error('No se encontró el modal con id "modalMetodos"');
        return;
    }
    
    const header = modal.querySelector('.modal-header h2');
    if (header) {
        header.textContent = `Equipo ${numeroEquipo}`;
    }
    
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
    if (!listaMetodos) {
        console.error('No se encontró elemento listaMetodos');
        return;
    }
    
    listaMetodos.innerHTML = `
        <div class="formulario-prestamo" style="padding: 20px;">
            <div style="margin-bottom: 15px;">
                <label for="documento" style="display: block; margin-bottom: 5px; font-weight: bold;">Documento:</label>
                <input type="text" id="documento" placeholder="Ingrese el número de documento" 
                    style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" />
                <small id="documento-status" style="display: block; margin-top: 5px; font-size: 0.8em;"></small>
            </div>
            
            <div style="margin-bottom: 15px;">
                <label for="profesor" style="display: block; margin-bottom: 5px; font-weight: bold;">Profesor(a) Encargado:</label>
                <input type="text" id="profesor" placeholder="Nombre del profesor encargado" 
                    style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" />
            </div>
            
            <div style="margin-bottom: 20px;">
                <label for="asignatura" style="display: block; margin-bottom: 5px; font-weight: bold;">Asignatura:</label>
                <input type="text" id="asignatura" placeholder="Materia o asignatura" 
                    style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;" />
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="btn-registrar" onclick="procesarPrestamo()" 
                    style="background-color: #007bff; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
                    Registrar Préstamo
                </button>
                <button onclick="cerrarModal()" 
                    style="background-color: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
                    Cancelar
                </button>
            </div>
        </div>
    `;
    
    // Enfocar el campo de documento y agregar validación
    setTimeout(() => {
        const documentoInput = document.getElementById('documento');
        if (documentoInput) {
            documentoInput.focus();
            documentoInput.addEventListener('input', function() {
                validarDocumentoEnTiempoReal(this.value.trim());
            });
        }
    }, 100);
}

// Validar documento en tiempo real
function validarDocumentoEnTiempoReal(documento) {
    const statusElement = document.getElementById('documento-status');
    const btnRegistrar = document.getElementById('btn-registrar');
    
    if (!statusElement || !btnRegistrar) return;
    
    if (!documento) {
        statusElement.textContent = '';
        statusElement.style.color = '';
        btnRegistrar.disabled = false;
        btnRegistrar.style.opacity = '1';
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
    if (!listaMetodos) return;
    
    listaMetodos.innerHTML = `
        <div style="padding: 20px;">
            <div class="readonly-info" style="background-color: #f8f9fa; padding: 15px; border-radius: 4px; margin-bottom: 15px;">
                <h4 style="margin-top: 0; color: #495057;">Información del Préstamo:</h4>
                <p style="margin: 8px 0;"><strong>Nombre:</strong> ${ultimoMovimiento.nombreCompleto}</p>
                <p style="margin: 8px 0;"><strong>Documento:</strong> ${ultimoMovimiento.documento}</p>
                <p style="margin: 8px 0;"><strong>Curso:</strong> ${ultimoMovimiento.curso}</p>
                <p style="margin: 8px 0;"><strong>Profesor Encargado:</strong> ${ultimoMovimiento.profesorEncargado}</p>
                <p style="margin: 8px 0;"><strong>Asignatura:</strong> ${ultimoMovimiento.materia}</p>
                <p style="margin: 8px 0;"><strong>Fecha de Préstamo:</strong> ${ultimoMovimiento.marcaTemporal.toLocaleString()}</p>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label for="comentario-devolucion" style="display: block; margin-bottom: 5px; font-weight: bold;">
                    Comentario sobre la devolución (opcional):
                </label>
                <textarea id="comentario-devolucion" placeholder="Ingrese comentarios sobre el estado del equipo..." 
                    style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; min-height: 80px; resize: vertical;"></textarea>
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button onclick="procesarDevolucion()" 
                    style="background-color: #28a745; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
                    Registrar Devolución
                </button>
                <button onclick="cerrarModal()" 
                    style="background-color: #6c757d; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer;">
                    Cancelar
                </button>
            </div>
        </div>
    `;
}

// Procesar registro de préstamo
async function procesarPrestamo() {
    console.log('Procesando préstamo...');
    
    const documentoInput = document.getElementById('documento');
    const profesorInput = document.getElementById('profesor');
    const asignaturaInput = document.getElementById('asignatura');
    
    if (!documentoInput || !profesorInput || !asignaturaInput) {
        console.error('No se encontraron los campos del formulario');
        alert('Error: No se pudieron encontrar los campos del formulario');
        return;
    }
    
    const documento = documentoInput.value.trim();
    const profesor = profesorInput.value.trim();
    const asignatura = asignaturaInput.value.trim();
    
    console.log('Datos del préstamo:', { documento, profesor, asignatura });
    
    if (!documento || !profesor || !asignatura) {
        alert('Por favor complete todos los campos requeridos');
        return;
    }
    
    // Validar que el documento exista
    const persona = personas.find(p => p.documento === documento);
    if (!persona) {
        alert(`El documento "${documento}" no está registrado en la base de datos.\n\nTotal personas disponibles: ${personas.length}`);
        console.log('Documentos disponibles:', personas.map(p => p.documento));
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
    
    console.log('Registro a enviar:', registro);
    
    try {
        mostrarEstadoSync('Registrando préstamo...');
        
        // Actualizar historial local inmediatamente
        const nuevoMovimiento = {
            marcaTemporal: new Date(),
            ...registro
        };
        
        historial.unshift(nuevoMovimiento);
        actualizarEstadoEquipos();
        cerrarModal();
        
        // Enviar a Google Forms
        await registrarEnGoogleForm(registro);
        mostrarEstadoSync('Préstamo registrado correctamente', 'success');
        
        // Recargar datos para sincronizar
        setTimeout(() => {
            cargarDatos();
        }, 2000);
        
    } catch (error) {
        console.error('Error registrando préstamo:', error);
        mostrarEstadoSync('Error registrando el préstamo', 'error');
        alert('Error registrando el préstamo. Verifique su conexión.');
        
        // Revertir cambio local en caso de error
        historial = historial.filter(h => h !== nuevoMovimiento);
        actualizarEstadoEquipos();
    }
}

// Procesar registro de devolución
async function procesarDevolucion() {
    console.log('Procesando devolución...');
    
    const comentarioInput = document.getElementById('comentario-devolucion');
    const comentario = comentarioInput ? comentarioInput.value.trim() : '';
    
    const estadoEquipo = obtenerEstadoEquipo(equipoSeleccionado.toString());
    const ultimoMovimiento = estadoEquipo.ultimoMovimiento;
    
    if (!ultimoMovimiento) {
        alert('Error: No se pudo obtener la información del préstamo');
        return;
    }
    
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
        
        // Actualizar historial local inmediatamente
        const nuevoMovimiento = {
            marcaTemporal: new Date(),
            ...registro
        };
        
        historial.unshift(nuevoMovimiento);
        actualizarEstadoEquipos();
        cerrarModal();
        
        // Enviar a Google Forms
        await registrarEnGoogleForm(registro);
        mostrarEstadoSync('Devolución registrada correctamente', 'success');
        
        // Recargar datos para sincronizar
        setTimeout(() => {
            cargarDatos();
        }, 2000);
        
    } catch (error) {
        console.error('Error registrando devolución:', error);
        mostrarEstadoSync('Error registrando la devolución', 'error');
        alert('Error registrando la devolución. Verifique su conexión.');
        
        // Revertir cambio local
        historial = historial.filter(h => h !== nuevoMovimiento);
        actualizarEstadoEquipos();
    }
}

// Registrar en Google Forms
async function registrarEnGoogleForm(registro) {
    const formData = new FormData();
    
    // Agregar todos los campos
    Object.keys(FORM_ENTRIES).forEach(key => {
        const value = registro[key] || '';
        formData.append(FORM_ENTRIES[key], value);
        console.log(`${key}: ${value} -> ${FORM_ENTRIES[key]}`);
    });
    
    try {
        const response = await fetch(GOOGLE_FORM_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: formData
        });
        
        console.log('Registro enviado a Google Forms');
        return true;
        
    } catch (error) {
        console.error('Error enviando a Google Forms:', error);
        throw new Error('No se pudo enviar el registro.');
    }
}

// Cerrar modal
function cerrarModal() {
    const modal = document.getElementById('modalMetodos');
    if (modal) {
        modal.style.display = 'none';
    }
    equipoSeleccionado = null;
}

// Mostrar estado de sincronización
function mostrarEstadoSync(mensaje, tipo = 'info') {
    const syncStatus = document.getElementById('sync-status');
    if (!syncStatus) {
        console.log(`SYNC: ${mensaje} (${tipo})`);
        return;
    }
    
    syncStatus.textContent = mensaje;
    syncStatus.className = `sync-status ${tipo}`;
    
    const colors = {
        success: '#28a745',
        error: '#dc3545',
        info: '#17a2b8'
    };
    
    syncStatus.style.color = colors[tipo] || colors.info;
    
    if (tipo === 'success' || tipo === 'error') {
        setTimeout(() => {
            syncStatus.textContent = '';
            syncStatus.className = 'sync-status';
        }, 5000);
    }
}

// Event listeners
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        cerrarModal();
    }
});

window.onclick = function(event) {
    const modal = document.getElementById('modalMetodos');
    if (event.target === modal) {
        cerrarModal();
    }
};

window.addEventListener('focus', function() {
    cargarDatos();
});

// Funciones de debugging
function debugPersonas() {
    console.log('=== DEBUG DE PERSONAS ===');
    console.log('Total personas:', personas.length);
    console.log('Primeras 5 personas:');
    personas.slice(0, 5).forEach((p, i) => {
        console.log(`${i + 1}. Documento: "${p.documento}", Nombre: "${p.nombreCompleto}"`);
    });
}

function debugHistorial() {
    console.log('=== DEBUG DE HISTORIAL ===');
    console.log('Total registros:', historial.length);
    console.log('Últimos 5 movimientos:');
    historial.slice(0, 5).forEach((h, i) => {
        console.log(`${i + 1}. Equipo ${h.equipo} - ${h.tipo} - ${h.nombreCompleto} (${h.marcaTemporal})`);
    });
}

function resetearMalla() {
    if (confirm('¿Está seguro que desea ver todos los equipos como disponibles?')) {
        historial = [];
        actualizarEstadoEquipos();
        mostrarEstadoSync('Vista actualizada localmente', 'info');
    }
}

// Exponer funciones de debug
window.debugPersonas = debugPersonas;
window.debugHistorial = debugHistorial;
window.resetearMalla = resetearMalla;

console.log('Sistema de Préstamo de Equipos inicializado correctamente');
