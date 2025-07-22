// Configuración de URLs y constantes
const CONFIG = {
    URLS: {
        PERSONAS: 'https://docs.google.com/spreadsheets/d/1GU1oKIb9E0Vvwye6zRB2F_fT2jGzRvJ0WoLtWKuio-E/gviz/tq?tqx=out:json&gid=1744634045',
        HISTORIAL: 'https://docs.google.com/spreadsheets/d/1ohT8rfNsG4h7JjPZllHoyrxePutKsv2Q-5mBeUozia0/gviz/tq?tqx=out:json&gid=1185155654',
        GOOGLE_FORM: 'https://docs.google.com/forms/d/e/1FAIpQLSfe3gplfkjNe3qEjC5l_Jqhsrk_zPSdQM_Wg0M6BUhoHtj9tg/formResponse'
    },
    FORM_ENTRIES: {
        equipo: 'entry.1834514522',
        nombreCompleto: 'entry.1486223911',
        documento: 'entry.1695051506',
        curso: 'entry.564849635',
        telefono: 'entry.414930075',
        profesorEncargado: 'entry.116949605',
        materia: 'entry.1714096158',
        tipo: 'entry.801360829',
        comentario: 'entry.43776270'
    },
    SYNC_INTERVAL: 30000, // 30 segundos
    FORM_DELAY: 15000,    // 15 segundos para que Google Forms procese
    TOTAL_EQUIPOS: 40,
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000
};

// Estado de la aplicación
class AppState {
    constructor() {
        this.personas = new Map(); // Usar Map para mejor rendimiento en búsquedas
        this.historial = [];
        this.equipoSeleccionado = null;
        this.isLoading = false;
        this.syncIntervalId = null;
    }

    // Métodos para manejo de personas
    setPersonas(personasArray) {
        this.personas.clear();
        personasArray.forEach(persona => {
            if (persona.documento) {
                this.personas.set(persona.documento, persona);
            }
        });
    }

    findPersonaByDocumento(documento) {
        return this.personas.get(documento) || null;
    }

    getPersonasCount() {
        return this.personas.size;
    }

    // Métodos para manejo de historial
    addHistorialEntry(entry) {
        this.historial.unshift({
            ...entry,
            marcaTemporal: new Date()
        });
    }

    removeHistorialEntry(entry) {
        const index = this.historial.indexOf(entry);
        if (index > -1) {
            this.historial.splice(index, 1);
        }
    }

    setHistorial(historialArray) {
        this.historial = historialArray.sort((a, b) => b.marcaTemporal - a.marcaTemporal);
    }

    getEquipoState(numeroEquipo) {
        const movimientosEquipo = this.historial.filter(h => h.equipo === numeroEquipo);
        
        if (movimientosEquipo.length === 0) {
            return { prestado: false };
        }
        
        const ultimoMovimiento = movimientosEquipo[0];
        
        return {
            prestado: ultimoMovimiento.tipo === 'Préstamo',
            ultimoMovimiento,
            nombreCompleto: ultimoMovimiento.nombreCompleto
        };
    }
}

// Instancia global del estado
const appState = new AppState();

// Utilidades
const Utils = {
    // Parsear respuesta de Google Sheets con mejor manejo de errores
    parseGoogleSheetsResponse(text) {
        try {
            if (!text.startsWith('/*O_o*/\ngoogle.visualization.Query.setResponse(')) {
                throw new Error('Formato de respuesta inválido');
            }
            
            const jsonString = text.substring(47).slice(0, -2);
            const jsonData = JSON.parse(jsonString);
            
            if (!jsonData?.table?.rows) {
                throw new Error('Estructura de datos inválida');
            }
            
            return jsonData;
        } catch (error) {
            console.error('Error parseando respuesta de Google Sheets:', error);
            throw new Error(`Error de formato de datos: ${error.message}`);
        }
    },

    // Extraer valor de celda con validación
    getCellValue(cell) {
        return cell && cell.v !== null && cell.v !== undefined ? cell.v.toString().trim() : '';
    },

    // Retry con backoff exponencial
    async retryWithBackoff(fn, attempts = CONFIG.RETRY_ATTEMPTS) {
        for (let i = 0; i < attempts; i++) {
            try {
                return await fn();
            } catch (error) {
                if (i === attempts - 1) throw error;
                
                const delay = CONFIG.RETRY_DELAY * Math.pow(2, i);
                console.warn(`Intento ${i + 1} falló, reintentando en ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    },

    // Debounce para validaciones
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Validar documento
    isValidDocument(documento) {
        return documento && /^\d+$/.test(documento.trim()) && documento.trim().length >= 6;
    }
};

// Manejo de UI
const UI = {
    // Crear elemento con atributos
    createElement(tag, attributes = {}, textContent = '') {
        const element = document.createElement(tag);
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'style' && typeof value === 'object') {
                Object.assign(element.style, value);
            } else {
                element.setAttribute(key, value);
            }
        });
        
        if (textContent) element.textContent = textContent;
        return element;
    },

    // Mostrar estado de sincronización con mejor UX
    showSyncStatus(mensaje, tipo = 'info', autoHide = true) {
        const syncStatus = document.getElementById('sync-status');
        if (!syncStatus) {
            console.log(`SYNC: ${mensaje} (${tipo})`);
            return;
        }
        
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        
        syncStatus.textContent = mensaje;
        syncStatus.className = `sync-status ${tipo}`;
        syncStatus.style.color = colors[tipo] || colors.info;
        syncStatus.style.opacity = '1';
        
        if (autoHide && (tipo === 'success' || tipo === 'error')) {
            setTimeout(() => {
                syncStatus.style.opacity = '0';
                setTimeout(() => {
                    syncStatus.textContent = '';
                    syncStatus.className = 'sync-status';
                }, 300);
            }, 4000);
        }
    },

    // Modal mejorado con mejor accesibilidad
    showModal(show = true) {
        const modal = document.getElementById('modalMetodos');
        if (!modal) return;
        
        if (show) {
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';
            // Enfocar primer elemento focuseable
            const firstFocusable = modal.querySelector('input, button, textarea, select');
            if (firstFocusable) firstFocusable.focus();
        } else {
            modal.style.display = 'none';
            document.body.style.overflow = '';
            appState.equipoSeleccionado = null;
        }
    },

    // Validación de documento en tiempo real mejorada
    validateDocumentRealTime: Utils.debounce(function(documento) {
        const statusElement = document.getElementById('documento-status');
        const btnRegistrar = document.getElementById('btn-registrar');
        
        if (!statusElement || !btnRegistrar) return;
        
        if (!documento) {
            statusElement.textContent = '';
            statusElement.className = '';
            btnRegistrar.disabled = false;
            btnRegistrar.style.opacity = '1';
            return;
        }
        
        // Validar formato
        if (!Utils.isValidDocument(documento)) {
            statusElement.textContent = '⚠ Formato de documento inválido';
            statusElement.className = 'warning';
            statusElement.style.color = '#ffc107';
            btnRegistrar.disabled = true;
            btnRegistrar.style.opacity = '0.6';
            return;
        }
        
        // Buscar en base de datos
        const persona = appState.findPersonaByDocumento(documento);
        if (persona) {
            statusElement.textContent = `✓ ${persona.nombreCompleto} - ${persona.curso}`;
            statusElement.className = 'success';
            statusElement.style.color = '#28a745';
            btnRegistrar.disabled = false;
            btnRegistrar.style.opacity = '1';
        } else {
            statusElement.textContent = `✗ Documento no encontrado (${appState.getPersonasCount()} registros disponibles)`;
            statusElement.className = 'error';
            statusElement.style.color = '#dc3545';
            btnRegistrar.disabled = true;
            btnRegistrar.style.opacity = '0.6';
        }
    }, 300)
};

// Carga de datos optimizada
const DataLoader = {
    // Cargar personas con mejor manejo de errores
    async loadPersonas() {
        const response = await fetch(CONFIG.URLS.PERSONAS);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const text = await response.text();
        const jsonData = Utils.parseGoogleSheetsResponse(text);
        
        const personas = jsonData.table.rows
            .slice(1) // Omitir encabezados
            .map((row, index) => {
                try {
                    return {
                        nombreCompleto: Utils.getCellValue(row.c[1]),
                        documento: Utils.getCellValue(row.c[2]),
                        curso: Utils.getCellValue(row.c[3]),
                        telefono: Utils.getCellValue(row.c[4])
                    };
                } catch (err) {
                    console.warn(`Error procesando fila ${index + 2} de personas:`, err);
                    return null;
                }
            })
            .filter(p => p && p.documento && Utils.isValidDocument(p.documento));
        
        appState.setPersonas(personas);
        console.log(`✓ Personas cargadas: ${appState.getPersonasCount()}`);
    },

    // Cargar historial con validación mejorada
    async loadHistorial() {
        const response = await fetch(CONFIG.URLS.HISTORIAL);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const text = await response.text();
        const jsonData = Utils.parseGoogleSheetsResponse(text);
        
        const historial = jsonData.table.rows
            .slice(1) // Omitir encabezados
            .map((row, index) => {
                try {
                    const marcaTemporal = row.c[0] && row.c[0].v ? 
                        new Date(row.c[0].v) : new Date();
                    
                    return {
                        marcaTemporal,
                        equipo: Utils.getCellValue(row.c[1]),
                        nombreCompleto: Utils.getCellValue(row.c[2]),
                        documento: Utils.getCellValue(row.c[3]),
                        curso: Utils.getCellValue(row.c[4]),
                        telefono: Utils.getCellValue(row.c[5]),
                        profesorEncargado: Utils.getCellValue(row.c[6]),
                        materia: Utils.getCellValue(row.c[7]),
                        tipo: Utils.getCellValue(row.c[8]),
                        comentario: Utils.getCellValue(row.c[9])
                    };
                } catch (err) {
                    console.warn(`Error procesando fila ${index + 2} de historial:`, err);
                    return null;
                }
            })
            .filter(h => h && h.equipo && ['Préstamo', 'Devolución'].includes(h.tipo));
        
        appState.setHistorial(historial);
        console.log(`✓ Historial cargado: ${historial.length} registros`);
    },

    // Cargar todos los datos con recuperación de errores
    async loadAllData() {
        if (appState.isLoading) {
            console.log('Carga ya en progreso...');
            return;
        }
        
        appState.isLoading = true;
        UI.showSyncStatus('Sincronizando datos...', 'info', false);
        
        try {
            await Utils.retryWithBackoff(async () => {
                await Promise.all([
                    this.loadPersonas(),
                    this.loadHistorial()
                ]);
            });
            
            EquipmentGrid.updateAllEquipmentStates();
            UI.showSyncStatus('✓ Datos sincronizados correctamente', 'success');
            
        } catch (error) {
            console.error('Error cargando datos:', error);
            UI.showSyncStatus('⚠ Error de sincronización - usando datos locales', 'warning');
            
            // Intentar actualizar solo la UI con datos existentes
            try {
                EquipmentGrid.updateAllEquipmentStates();
            } catch (uiError) {
                console.error('Error actualizando UI:', uiError);
                UI.showSyncStatus('❌ Error crítico - recargue la página', 'error');
            }
        } finally {
            appState.isLoading = false;
        }
    }
};

// Manejo de la malla de equipos
const EquipmentGrid = {
    // Crear malla optimizada
    create() {
        const malla = document.getElementById('malla');
        if (!malla) {
            console.error('Elemento "malla" no encontrado');
            return;
        }
        
        // Usar DocumentFragment para mejor rendimiento
        const fragment = document.createDocumentFragment();
        
        for (let i = 1; i <= CONFIG.TOTAL_EQUIPOS; i++) {
            const equipo = UI.createElement('div', {
                class: 'ramo',
                'data-equipo': i,
                style: {
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    userSelect: 'none'
                }
            });
            
            // Event listener optimizado
            equipo.addEventListener('click', () => EquipmentModal.open(i));
            
            // Hover effects
            equipo.addEventListener('mouseenter', function() {
                if (!this.classList.contains('equipo-prestado')) {
                    this.style.transform = 'scale(1.02)';
                    this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                }
            });
            
            equipo.addEventListener('mouseleave', function() {
                this.style.transform = '';
                this.style.boxShadow = '';
            });
            
            const numero = UI.createElement('div', {
                style: { fontWeight: 'bold' }
            }, `Equipo ${i}`);
            
            const estado = UI.createElement('div', {
                class: 'estado-equipo',
                style: {
                    fontSize: '0.9em',
                    marginTop: '5px'
                }
            }, 'Disponible');
            
            equipo.appendChild(numero);
            equipo.appendChild(estado);
            fragment.appendChild(equipo);
        }
        
        malla.innerHTML = '';
        malla.appendChild(fragment);
        console.log('✓ Malla de equipos creada');
    },

    // Actualizar estado de todos los equipos optimizado
    updateAllEquipmentStates() {
        const equipments = document.querySelectorAll('[data-equipo]');
        const updates = [];
        
        equipments.forEach(elemento => {
            const numeroEquipo = elemento.dataset.equipo;
            const estadoEquipo = appState.getEquipoState(numeroEquipo);
            const estadoElemento = elemento.querySelector('.estado-equipo');
            
            updates.push(() => {
                // Limpiar clases previas
                elemento.classList.remove('equipo-prestado', 'equipo-disponible');
                
                if (estadoEquipo.prestado) {
                    elemento.classList.add('equipo-prestado');
                    Object.assign(elemento.style, {
                        backgroundColor: '#d4edda',
                        borderColor: '#28a745',
                        color: '#155724'
                    });
                    
                    if (estadoElemento) {
                        estadoElemento.textContent = `Prestado a: ${estadoEquipo.nombreCompleto}`;
                    }
                } else {
                    elemento.classList.add('equipo-disponible');
                    Object.assign(elemento.style, {
                        backgroundColor: '#f8f9fa',
                        borderColor: '#dee2e6',
                        color: '#495057'
                    });
                    
                    if (estadoElemento) {
                        estadoElemento.textContent = 'Disponible';
                    }
                }
            });
        });
        
        // Batch DOM updates
        updates.forEach(update => update());
        console.log('✓ Estados de equipos actualizados');
    }
};

// Manejo de modales mejorado
const EquipmentModal = {
    open(numeroEquipo) {
        console.log(`Abriendo modal para equipo ${numeroEquipo}`);
        appState.equipoSeleccionado = numeroEquipo;
        
        const estadoEquipo = appState.getEquipoState(numeroEquipo.toString());
        
        // Actualizar header del modal
        const modal = document.getElementById('modalMetodos');
        const header = modal?.querySelector('.modal-header h2');
        if (header) {
            header.textContent = `Equipo ${numeroEquipo}`;
        }
        
        if (estadoEquipo.prestado) {
            this.showReturnForm(estadoEquipo.ultimoMovimiento);
        } else {
            this.showLoanForm();
        }
        
        UI.showModal(true);
    },

    showLoanForm() {
        const listaMetodos = document.getElementById('listaMetodos');
        if (!listaMetodos) return;
        
        listaMetodos.innerHTML = `
            <div class="formulario-prestamo" style="padding: 20px;">
                <div style="margin-bottom: 15px;">
                    <label for="documento" style="display: block; margin-bottom: 5px; font-weight: bold;">
                        Documento: <span style="color: #dc3545;">*</span>
                    </label>
                    <input 
                        type="text" 
                        id="documento" 
                        placeholder="Ej: 12345678" 
                        style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px;"
                        autocomplete="off"
                        inputmode="numeric"
                        pattern="[0-9]*"
                    />
                    <small id="documento-status" style="display: block; margin-top: 5px; font-size: 0.85em;"></small>
                </div>
                
                <div style="margin-bottom: 15px;">
                    <label for="profesor" style="display: block; margin-bottom: 5px; font-weight: bold;">
                        Profesor(a) Encargado: <span style="color: #dc3545;">*</span>
                    </label>
                    <input 
                        type="text" 
                        id="profesor" 
                        placeholder="Nombre completo del profesor" 
                        style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px;"
                        autocomplete="off"
                    />
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label for="asignatura" style="display: block; margin-bottom: 5px; font-weight: bold;">
                        Asignatura: <span style="color: #dc3545;">*</span>
                    </label>
                    <input 
                        type="text" 
                        id="asignatura" 
                        placeholder="Nombre de la materia" 
                        style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 16px;"
                        autocomplete="off"
                    />
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 30px;">
                    <button id="btn-registrar" onclick="LoanProcessor.process()" 
                        style="background-color: #007bff; color: white; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; font-size: 16px; transition: all 0.2s;">
                        Registrar Préstamo
                    </button>
                    <button onclick="EquipmentModal.close()" 
                        style="background-color: #6c757d; color: white; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; font-size: 16px;">
                        Cancelar
                    </button>
                </div>
            </div>
        `;
        
        // Setup form interactions
        setTimeout(() => {
            const documentoInput = document.getElementById('documento');
            if (documentoInput) {
                documentoInput.focus();
                
                // Validación en tiempo real
                documentoInput.addEventListener('input', (e) => {
                    UI.validateDocumentRealTime(e.target.value.trim());
                });
                
                // Solo permitir números
                documentoInput.addEventListener('keypress', (e) => {
                    if (!/\d/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter'].includes(e.key)) {
                        e.preventDefault();
                    }
                });
            }
            
            // Enter key submission
            const form = document.querySelector('.formulario-prestamo');
            if (form) {
                form.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter' && !e.target.matches('textarea')) {
                        e.preventDefault();
                        LoanProcessor.process();
                    }
                });
            }
        }, 100);
    },

    showReturnForm(ultimoMovimiento) {
        const listaMetodos = document.getElementById('listaMetodos');
        if (!listaMetodos) return;
        
        listaMetodos.innerHTML = `
            <div style="padding: 20px;">
                <div class="readonly-info" style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #007bff;">
                    <h4 style="margin-top: 0; color: #495057; margin-bottom: 15px;">📋 Información del Préstamo</h4>
                    <div style="display: grid; gap: 8px;">
                        <p style="margin: 0;"><strong>Nombre:</strong> ${ultimoMovimiento.nombreCompleto}</p>
                        <p style="margin: 0;"><strong>Documento:</strong> ${ultimoMovimiento.documento}</p>
                        <p style="margin: 0;"><strong>Curso:</strong> ${ultimoMovimiento.curso}</p>
                        <p style="margin: 0;"><strong>Profesor:</strong> ${ultimoMovimiento.profesorEncargado}</p>
                        <p style="margin: 0;"><strong>Asignatura:</strong> ${ultimoMovimiento.materia}</p>
                        <p style="margin: 0;"><strong>Prestado:</strong> ${ultimoMovimiento.marcaTemporal.toLocaleString()}</p>
                    </div>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <label for="comentario-devolucion" style="display: block; margin-bottom: 8px; font-weight: bold;">
                        💬 Comentarios sobre la devolución (opcional):
                    </label>
                    <textarea 
                        id="comentario-devolucion" 
                        placeholder="Estado del equipo, daños, observaciones..."
                        style="width: 100%; padding: 12px; border: 1px solid #ddd; border-radius: 4px; min-height: 100px; resize: vertical; font-family: inherit; font-size: 14px;"
                    ></textarea>
                </div>
                
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 30px;">
                    <button onclick="ReturnProcessor.process()" 
                        style="background-color: #28a745; color: white; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; font-size: 16px;">
                        ✓ Registrar Devolución
                    </button>
                    <button onclick="EquipmentModal.close()" 
                        style="background-color: #6c757d; color: white; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; font-size: 16px;">
                        Cancelar
                    </button>
                </div>
            </div>
        `;
    },

    close() {
        UI.showModal(false);
    }
};

// Procesamiento de préstamos mejorado
const LoanProcessor = {
    async process() {
        if (appState.isLoading) {
            UI.showSyncStatus('Operación en progreso, espere...', 'warning');
            return;
        }
        
        const formData = this.getFormData();
        if (!formData) return;
        
        const validationError = this.validateFormData(formData);
        if (validationError) {
            alert(validationError);
            return;
        }
        
        const persona = appState.findPersonaByDocumento(formData.documento);
        if (!persona) {
            alert(`El documento "${formData.documento}" no está registrado.\n\nPersonas disponibles: ${appState.getPersonasCount()}`);
            return;
        }
        
        const registro = this.createLoanRecord(formData, persona);
        
        try {
            await this.submitLoan(registro);
        } catch (error) {
            console.error('Error procesando préstamo:', error);
            alert('Error registrando el préstamo. Verifique su conexión e inténtelo nuevamente.');
        }
    },

    getFormData() {
        const documentoInput = document.getElementById('documento');
        const profesorInput = document.getElementById('profesor');
        const asignaturaInput = document.getElementById('asignatura');
        
        if (!documentoInput || !profesorInput || !asignaturaInput) {
            console.error('Campos del formulario no encontrados');
            alert('Error: Formulario no válido');
            return null;
        }
        
        return {
            documento: documentoInput.value.trim(),
            profesor: profesorInput.value.trim(),
            asignatura: asignaturaInput.value.trim()
        };
    },

    validateFormData(data) {
        if (!data.documento) return 'El documento es requerido';
        if (!data.profesor) return 'El profesor encargado es requerido';
        if (!data.asignatura) return 'La asignatura es requerida';
        
        if (!Utils.isValidDocument(data.documento)) {
            return 'El documento debe contener solo números y tener al menos 6 dígitos';
        }
        
        if (data.profesor.length < 3) return 'El nombre del profesor es muy corto';
        if (data.asignatura.length < 2) return 'El nombre de la asignatura es muy corto';
        
        return null;
    },

    createLoanRecord(formData, persona) {
        return {
            equipo: appState.equipoSeleccionado.toString(),
            nombreCompleto: persona.nombreCompleto,
            documento: persona.documento,
            curso: persona.curso,
            telefono: persona.telefono,
            profesorEncargado: formData.profesor,
            materia: formData.asignatura,
            tipo: 'Préstamo',
            comentario: ''
        };
    },

    async submitLoan(registro) {
        UI.showSyncStatus('Registrando préstamo...', 'info', false);
        
        // Crear movimiento local
        const nuevoMovimiento = {
            marcaTemporal: new Date(),
            ...registro
        };
        
        // Actualizar estado local inmediatamente
        appState.addHistorialEntry(nuevoMovimiento);
        EquipmentGrid.updateAllEquipmentStates();
        EquipmentModal.close();
        
        try {
            // Enviar a Google Forms
            await FormSubmitter.submit(registro);
            UI.showSyncStatus('✓ Préstamo registrado correctamente', 'success');
            
            // Recargar después del delay de Google Forms
            setTimeout(() => {
                console.log('Recargando datos después de préstamo...');
                DataLoader.loadAllData();
            }, CONFIG.FORM_DELAY);
            
        } catch (error) {
            // Revertir cambios locales en caso de error
            appState.removeHistorialEntry(nuevoMovimiento);
            EquipmentGrid.updateAllEquipmentStates();
            throw error;
        }
    }
};

// Procesamiento de devoluciones mejorado
const ReturnProcessor = {
    async process() {
        if (appState.isLoading) {
            UI.showSyncStatus('Operación en progreso, espere...', 'warning');
            return;
        }
        
        const estadoEquipo = appState.getEquipoState(appState.equipoSeleccionado.toString());
        const ultimoMovimiento = estadoEquipo.ultimoMovimiento;
        
        if (!ultimoMovimiento) {
            alert('Error: No se pudo obtener la información del préstamo');
            return;
        }
        
        const comentarioInput = document.getElementById('comentario-devolucion');
        const comentario = comentarioInput ? comentarioInput.value.trim() : '';
        
        const registro = {
            equipo: appState.equipoSeleccionado.toString(),
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
            await this.submitReturn(registro);
        } catch (error) {
            console.error('Error procesando devolución:', error);
            alert('Error registrando la devolución. Verifique su conexión e inténtelo nuevamente.');
        }
    },

    async submitReturn(registro) {
        UI.showSyncStatus('Registrando devolución...', 'info', false);
        
        // Crear movimiento local
        const nuevoMovimiento = {
            marcaTemporal: new Date(),
            ...registro
        };
        
        // Actualizar estado local inmediatamente
        appState.addHistorialEntry(nuevoMovimiento);
        EquipmentGrid.updateAllEquipmentStates();
        EquipmentModal.close();
        
        try {
            // Enviar a Google Forms
            await FormSubmitter.submit(registro);
            UI.showSyncStatus('✓ Devolución registrada correctamente', 'success');
            
            // Recargar después del delay de Google Forms
            setTimeout(() => {
                console.log('Recargando datos después de devolución...');
                DataLoader.loadAllData();
            }, CONFIG.FORM_DELAY);
            
        } catch (error) {
            // Revertir cambios locales en caso de error
            appState.removeHistorialEntry(nuevoMovimiento);
            EquipmentGrid.updateAllEquipmentStates();
            throw error;
        }
    }
};

// Envío de formularios con mejor manejo de errores
const FormSubmitter = {
    async submit(registro) {
        console.log('Enviando registro a Google Forms:', registro);
        
        const formData = new FormData();
        
        // Mapear todos los campos al formulario
        Object.entries(CONFIG.FORM_ENTRIES).forEach(([key, entryId]) => {
            const value = registro[key] || '';
            formData.append(entryId, value);
        });
        
        // Log para debugging
        if (console.log) {
            console.group('Datos enviados a Google Forms:');
            Object.entries(CONFIG.FORM_ENTRIES).forEach(([key, entryId]) => {
                console.log(`${key}: "${registro[key] || ''}" → ${entryId}`);
            });
            console.groupEnd();
        }
        
        try {
            const response = await fetch(CONFIG.URLS.GOOGLE_FORM, {
                method: 'POST',
                mode: 'no-cors',
                body: formData
            });
            
            console.log('✓ Registro enviado a Google Forms');
            return true;
            
        } catch (error) {
            console.error('❌ Error enviando a Google Forms:', error);
            throw new Error('No se pudo enviar el registro al servidor');
        }
    }
};

// Manejo de eventos globales mejorado
const EventManager = {
    init() {
        // Event listeners para el modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                EquipmentModal.close();
            }
        });
        
        // Click fuera del modal para cerrar
        window.addEventListener('click', (event) => {
            const modal = document.getElementById('modalMetodos');
            if (event.target === modal) {
                EquipmentModal.close();
            }
        });
        
        // Recargar datos cuando la ventana recibe el foco
        window.addEventListener('focus', () => {
            if (!appState.isLoading) {
                console.log('Ventana recibió el foco, recargando datos...');
                DataLoader.loadAllData();
            }
        });
        
        // Manejo de errores globales
        window.addEventListener('error', (event) => {
            console.error('Error global:', event.error);
            UI.showSyncStatus('Error inesperado - recargue la página si persiste', 'error');
        });
        
        // Manejo de errores de promesas no capturadas
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Promesa rechazada no manejada:', event.reason);
            UI.showSyncStatus('Error de conexión - verificando...', 'warning');
        });
        
        console.log('✓ Event listeners configurados');
    },

    // Configurar sincronización automática
    setupAutoSync() {
        // Limpiar intervalo anterior si existe
        if (appState.syncIntervalId) {
            clearInterval(appState.syncIntervalId);
        }
        
        // Configurar nuevo intervalo
        appState.syncIntervalId = setInterval(() => {
            if (!appState.isLoading && document.visibilityState === 'visible') {
                console.log('Sincronización automática...');
                DataLoader.loadAllData();
            }
        }, CONFIG.SYNC_INTERVAL);
        
        console.log(`✓ Sincronización automática cada ${CONFIG.SYNC_INTERVAL / 1000}s`);
    },

    // Limpiar recursos
    cleanup() {
        if (appState.syncIntervalId) {
            clearInterval(appState.syncIntervalId);
            appState.syncIntervalId = null;
        }
    }
};

// Funciones de debugging mejoradas
const Debug = {
    logPersonas() {
        console.group('🔍 DEBUG - PERSONAS');
        console.log(`Total personas: ${appState.getPersonasCount()}`);
        
        const personas = Array.from(appState.personas.values()).slice(0, 10);
        console.table(personas.map(p => ({
            documento: p.documento,
            nombre: p.nombreCompleto,
            curso: p.curso
        })));
        
        console.groupEnd();
    },

    logHistorial() {
        console.group('🔍 DEBUG - HISTORIAL');
        console.log(`Total registros: ${appState.historial.length}`);
        
        const recientes = appState.historial.slice(0, 10);
        console.table(recientes.map(h => ({
            equipo: h.equipo,
            tipo: h.tipo,
            nombre: h.nombreCompleto,
            fecha: h.marcaTemporal.toLocaleString()
        })));
        
        console.groupEnd();
    },

    logEquiposStatus() {
        console.group('🔍 DEBUG - ESTADO EQUIPOS');
        
        const prestados = [];
        const disponibles = [];
        
        for (let i = 1; i <= CONFIG.TOTAL_EQUIPOS; i++) {
            const estado = appState.getEquipoState(i.toString());
            if (estado.prestado) {
                prestados.push({
                    equipo: i,
                    usuario: estado.nombreCompleto,
                    fecha: estado.ultimoMovimiento.marcaTemporal.toLocaleString()
                });
            } else {
                disponibles.push(i);
            }
        }
        
        console.log(`Equipos prestados: ${prestados.length}`);
        console.table(prestados);
        console.log(`Equipos disponibles (${disponibles.length}):`, disponibles.join(', '));
        
        console.groupEnd();
    },

    resetMalla() {
        if (!confirm('⚠️ ¿Está seguro de resetear la vista local?\n\nEsto mostrará todos los equipos como disponibles hasta la próxima sincronización.')) {
            return;
        }
        
        appState.setHistorial([]);
        EquipmentGrid.updateAllEquipmentStates();
        UI.showSyncStatus('Vista local reseteada', 'warning');
        console.log('🔄 Vista local reseteada');
    },

    forceSync() {
        console.log('🔄 Forzando sincronización...');
        DataLoader.loadAllData();
    },

    showStats() {
        console.group('📊 ESTADÍSTICAS DEL SISTEMA');
        console.log(`Personas registradas: ${appState.getPersonasCount()}`);
        console.log(`Movimientos registrados: ${appState.historial.length}`);
        
        const equiposPrestados = [];
        for (let i = 1; i <= CONFIG.TOTAL_EQUIPOS; i++) {
            if (appState.getEquipoState(i.toString()).prestado) {
                equiposPrestados.push(i);
            }
        }
        
        console.log(`Equipos prestados: ${equiposPrestados.length}/${CONFIG.TOTAL_EQUIPOS}`);
        console.log(`Tasa de utilización: ${((equiposPrestados.length / CONFIG.TOTAL_EQUIPOS) * 100).toFixed(1)}%`);
        
        // Estadísticas por tipo de movimiento
        const prestamos = appState.historial.filter(h => h.tipo === 'Préstamo').length;
        const devoluciones = appState.historial.filter(h => h.tipo === 'Devolución').length;
        
        console.log(`Préstamos registrados: ${prestamos}`);
        console.log(`Devoluciones registradas: ${devoluciones}`);
        
        console.groupEnd();
    }
};

// Inicialización principal mejorada
const App = {
    async init() {
        console.group('🚀 INICIANDO SISTEMA DE PRÉSTAMO DE EQUIPOS');
        
        try {
            // Verificar elementos DOM críticos
            const requiredElements = ['malla', 'modalMetodos'];
            const missingElements = requiredElements.filter(id => !document.getElementById(id));
            
            if (missingElements.length > 0) {
                throw new Error(`Elementos DOM faltantes: ${missingElements.join(', ')}`);
            }
            
            console.log('✓ Elementos DOM verificados');
            
            // Inicializar componentes
            EquipmentGrid.create();
            EventManager.init();
            EventManager.setupAutoSync();
            
            // Cargar datos iniciales
            await DataLoader.loadAllData();
            
            // Exponer funciones de debugging
            window.debug = Debug;
            
            console.log('✅ Sistema inicializado correctamente');
            console.log('💡 Usa window.debug para funciones de debugging');
            
        } catch (error) {
            console.error('❌ Error crítico inicializando la aplicación:', error);
            UI.showSyncStatus('Error crítico - verifique la consola', 'error');
            
            // Mostrar error al usuario
            alert(`Error inicializando la aplicación:\n\n${error.message}\n\nRevise la consola para más detalles.`);
        } finally {
            console.groupEnd();
        }
    },

    // Cleanup cuando se cierra la aplicación
    destroy() {
        console.log('🧹 Limpiando recursos...');
        EventManager.cleanup();
    }
};

// Event listeners de carga
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

window.addEventListener('beforeunload', () => {
    App.destroy();
});

// Exponer API pública
window.EquipmentLoanSystem = {
    debug: Debug,
    forceSync: () => DataLoader.loadAllData(),
    getStats: () => ({
        personas: appState.getPersonasCount(),
        historial: appState.historial.length,
        equiposPrestados: Array.from({length: CONFIG.TOTAL_EQUIPOS}, (_, i) => i + 1)
            .filter(i => appState.getEquipoState(i.toString()).prestado).length
    })
};

console.log('📦 Sistema de Préstamo de Equipos v2.0 - Optimizado y listo');
