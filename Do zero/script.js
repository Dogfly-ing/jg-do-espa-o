const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// --- CONTROLES ANTI-BUG ---
const keys = {};
window.addEventListener('keydown', e => keys[e.code] = true);
window.addEventListener('keyup', e => keys[e.code] = false);

// Suporte Mobile
const jBase = document.getElementById('joystick-base');
const jKnob = document.getElementById('joystick-knob');
const btnBoost = document.getElementById('boost-btn');

let joystickActive = false;
let mobileBoost = false;
let jStartX = 0, jStartY = 0;
let jInputX = 0, jInputY = 0;

if(jBase) {
    jBase.addEventListener('touchstart', e => {
        joystickActive = true;
        const rect = jBase.getBoundingClientRect();
        jStartX = rect.left + rect.width / 2;
        jStartY = rect.top + rect.height / 2;
        handleJoystickMove(e.touches[0]);
        e.preventDefault();
    }, { passive: false });

    window.addEventListener('touchmove', e => {
        if (!joystickActive) return;
        for(let i=0; i<e.touches.length; i++){
            if(e.touches[i].target === jBase || e.touches[i].target === jKnob){
                handleJoystickMove(e.touches[i]);
            }
        }
    }, { passive: false });

    window.addEventListener('touchend', e => {
        if(e.touches.length === 0) {
            joystickActive = false;
            jInputX = 0; jInputY = 0;
            jKnob.style.transform = `translate(0px, 0px)`;
        }
    });
}

function handleJoystickMove(touch) {
    let dx = touch.clientX - jStartX;
    let dy = touch.clientY - jStartY;
    const maxDist = 35;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > maxDist) {
        dx = (dx / dist) * maxDist;
        dy = (dy / dist) * maxDist;
    }
    jInputX = dx / maxDist;
    jInputY = dy / maxDist;
    if(jKnob) jKnob.style.transform = `translate(${dx}px, ${dy}px)`;
}

if(btnBoost) {
    btnBoost.addEventListener('touchstart', (e) => { mobileBoost = true; e.preventDefault(); }, { passive: false });
    btnBoost.addEventListener('touchend', (e) => { mobileBoost = false; e.preventDefault(); }, { passive: false });
}

// --- SISTEMAS VISUAIS AVANÇADOS ---
let camera = { x: 0, y: 0, zoom: 1 };
let exhaustParticles = [];
let sonicBooms = [];      
let boomParticles = [];   

// Estados de Dimensão e Tempo
let hyperDriveActive = false;
let flashAlpha = 0;
let hyperDriveTimer = 0; // Temporizador para os 5 segundos no plano branco

// Matrix/Hacker Effect
let hackerLines = [];
const hackerChars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ$#@&%?";
function initHackerEffect() {
    hackerLines = [];
    let columns = Math.ceil(canvas.width / 20);
    for(let i = 0; i < columns; i++) {
        hackerLines.push({
            x: i * 20,
            y: Math.random() * -canvas.height,
            speed: Math.random() * 5 + 4,
            chars: Array.from({length: Math.floor(Math.random() * 15) + 10}, () => hackerChars[Math.floor(Math.random() * hackerChars.length)])
        });
    }
}

// --- NAVE COMPLETA E CORRIGIDA ---
const ship = {
    x: 0, y: 0, vx: 0, vy: 0, angle: 0,
    baseSpeed: 0.06,  
    friction: 0.97,
    isBoosting: false,
    
    boostDuration: 0,   // Acumula o tempo em milissegundos
    lastFrameTime: Date.now(),
    boomInterval: 0,    

    draw() {
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(this.angle);

        // VFX do motor (Plasma Fluido)
        const isMoving = joystickActive ? (Math.sqrt(jInputX*jInputX + jInputY*jInputY) > 0.2) : (keys['KeyW'] || keys['ArrowUp']);
        if (isMoving || this.isBoosting) {
            let pCount = this.isBoosting ? 5 : 1;
            for(let i=0; i<pCount; i++) {
                exhaustParticles.push({
                    x: this.x - Math.cos(this.angle) * 12,
                    y: this.y - Math.sin(this.angle) * 12,
                    vx: -Math.cos(this.angle) * (this.isBoosting ? 14 : 4) + (Math.random() - 0.5) * 3,
                    vy: -Math.sin(this.angle) * (this.isBoosting ? 14 : 4) + (Math.random() - 0.5) * 3,
                    size: Math.random() * (this.isBoosting ? 7 : 3.5) + 2,
                    life: 1,
                    decay: Math.random() * 0.03 + 0.02,
                    color: hyperDriveActive ? '#111111' : (this.isBoosting ? '#00ffcc' : '#ff5500')
                });
            }
        }

        // Desenho clássico geométrico da nave
        ctx.fillStyle = hyperDriveActive ? "#000000" : "#ffffff";
        ctx.shadowBlur = this.isBoosting ? 30 : 15;
        ctx.shadowColor = hyperDriveActive ? "rgba(0,0,0,0.3)" : (this.isBoosting ? "#00ffff" : "#0077ff");
        
        ctx.beginPath();
        ctx.moveTo(22, 0);
        ctx.lineTo(-12, 13);
        ctx.lineTo(-6, 0);
        ctx.lineTo(-12, -13);
        ctx.closePath();
        ctx.fill();
        
        // Cabine
        ctx.fillStyle = hyperDriveActive ? "#ff0055" : (this.isBoosting ? "#ff0055" : "#00d2ff");
        ctx.beginPath(); ctx.arc(4, 0, 4, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    },

    update() {
        let now = Date.now();
        let deltaTime = now - this.lastFrameTime;
        this.lastFrameTime = now;

        this.isBoosting = keys['ShiftLeft'] || keys['ShiftRight'] || mobileBoost;
        let currentAccel = this.baseSpeed;
        
        if (this.isBoosting && !hyperDriveActive) {
            this.boostDuration += deltaTime; 
            
            let timeFactor = Math.min(1, this.boostDuration / 10000); 
            currentAccel += timeFactor * 0.45;

            // Múltiplas explosões sônicas fluidas seguidas (ficam frenéticas perto do fim!)
            this.boomInterval += deltaTime;
            let currentTargetInterval = Math.max(180, 1400 - (timeFactor * 1300)); // Diminui o intervalo para explodir sem parar
            
            if (this.boomInterval >= currentTargetInterval) {
                this.boomInterval = 0;
                this.triggerSonicBoom();
            }

            // GATILHO DE 10 SEGUNDOS REAIS
            if (this.boostDuration >= 10000) {
                hyperDriveActive = true;
                hyperDriveTimer = 0;
                flashAlpha = 1; 
                this.triggerSonicBoom(75); 
            }
        } else if (!this.isBoosting) {
            if(!hyperDriveActive) this.boostDuration = Math.max(0, this.boostDuration - deltaTime * 1.5);
            this.boomInterval = 0;
        }

        // Movimentação
        if (joystickActive) {
            const dist = Math.sqrt(jInputX * jInputX + jInputY * jInputY);
            if (dist > 0.15) {
                this.angle = Math.atan2(jInputY, jInputX);
                this.vx += Math.cos(this.angle) * currentAccel * dist;
                this.vy += Math.sin(this.angle) * currentAccel * dist;
            }
        } else {
            if (keys['KeyA'] || keys['ArrowLeft']) this.angle -= 0.05;
            if (keys['KeyD'] || keys['ArrowRight']) this.angle += 0.05;
            if (keys['KeyW'] || keys['ArrowUp']) {
                this.vx += Math.cos(this.angle) * currentAccel;
                this.vy += Math.sin(this.angle) * currentAccel;
            }
        }
        
        this.vx *= this.friction;
        this.vy *= this.friction;

        let maxVel = hyperDriveActive ? 12 : (this.isBoosting ? 7 + ((this.boostDuration / 10000) * 16) : 7);
        let currentVel = Math.sqrt(this.vx*this.vx + this.vy*this.vy);
        if(currentVel > maxVel) {
            this.vx = (this.vx / currentVel) * maxVel;
            this.vy = (this.vy / currentVel) * maxVel;
        }

        this.x += this.vx;
        this.y += this.vy;
        camera.x = this.x;
        camera.y = this.y;

        // Controle de Zoom Dinâmico
        if (this.isBoosting && !hyperDriveActive) {
            let targetZoom = 1 - (this.boostDuration / 10000) * 0.45;
            camera.zoom += (targetZoom - camera.zoom) * 0.03; 
        } else {
            let targetZoom = hyperDriveActive ? 0.85 : 1;
            camera.zoom += (targetZoom - camera.zoom) * 0.05;
        }

        // GERENCIADOR DOS 5 SEGUNDOS NO PLANO QUADRICULADO + RETORNO
        if (hyperDriveActive) {
            hyperDriveTimer += deltaTime;
            
            // Ativa o efeito hacker faltando 1.5 segundos para acabar os 5 segundos totais
            if (hyperDriveTimer >= 3500 && hackerLines.length === 0) {
                initHackerEffect();
            }

            // Acabou os 5 segundos: Reseta tudo e volta pro espaço
            if (hyperDriveTimer >= 5000) {
                hyperDriveActive = false;
                this.boostDuration = 0;
                this.boomInterval = 0;
                hackerLines = [];
                flashAlpha = 1; // Outro clarão de transição
                this.triggerSonicBoom(40);
            }
        }
    },

    triggerSonicBoom(customParticleCount = 25) {
        sonicBooms.push({ x: this.x, y: this.y, radius: 5, maxRadius: hyperDriveActive ? 650 : 250, alpha: 1.2 });
        
        for (let i = 0; i < customParticleCount; i++) {
            let pAngle = Math.random() * Math.PI * 2;
            let pSpeed = Math.random() * (hyperDriveActive ? 14 : 8) + 3;
            boomParticles.push({
                x: this.x, y: this.y,
                vx: Math.cos(pAngle) * pSpeed + this.vx,
                vy: Math.sin(pAngle) * pSpeed + this.vy,
                size: Math.random() * 9 + 4,
                life: 1,
                decay: Math.random() * 0.02 + 0.015,
                colorHue: hyperDriveActive ? 0 : (Math.random() > 0.5 ? 180 : 310)
            });
        }
    }
};

// --- GERAÇÃO DO UNIVERSO ---
const MAP_SIZE = 3000; // Tamanho ideal para repetição sem engasgos
const stars = [];
for (let i = 0; i < 1000
    ; i++) stars.push({ x: Math.random() * MAP_SIZE, y: Math.random() * MAP_SIZE, size: Math.random() * 1.5 + 0.3, depth: Math.random() * 0.7 + 0.2 });

const nebulae = [];
for (let i = 0; i < 35; i++) nebulae.push({ x: Math.random() * MAP_SIZE, y: Math.random() * MAP_SIZE, radius: Math.random() * 600 + 400, color: `hsla(${Math.random() * 60 + 230}, 100%, 50%, 0.05)`, depth: 0.1 });

const celestialBodies = [];
for(let i=0; i<6; i++) celestialBodies.push({ type: 'sun', x: (Math.random()-0.5)*8000, y: (Math.random()-0.5)*8000, radius: Math.random()*100+70, color: `hsl(${Math.random()*25+15}, 100%, 55%)` });
for (let i = 0; i < 40; i++) {
    let lines = [];
    for(let j=0; j<8; j++) lines.push({ y: (Math.random()-0.5)*2, h: Math.random()*0.2+0.05, c: `rgba(0,0,0,${Math.random()*0.25})` });
    celestialBodies.push({ type: 'planet', x: (Math.random()-0.5)*12000, y: (Math.random()-0.5)*12000, radius: Math.random()*50+20, color1: `hsl(${Math.random()*360}, 85%, 50%)`, color2: `hsl(${Math.random()*360}, 100%, 6%)`, lines: lines, ring: Math.random() > 0.8, ringColor: `hsla(${Math.random()*360}, 70%, 70%, 0.45)` });
}

// --- DESENHO DO ESPAÇO REESTRUTURADO E INFINITO ---
function drawSpace(shakeX, drawY) {
    // 1. Nebulosas
    ctx.globalCompositeOperation = 'screen';
    nebulae.forEach(n => {
        let drawX = (n.x - camera.x * n.depth) % MAP_SIZE;
        let drawY = (n.y - camera.y * n.depth) % MAP_SIZE;
        if (drawX < 0) drawX += MAP_SIZE;
        if (drawY < 0) drawY += MAP_SIZE;

        // Renderiza réplicas ao redor para preencher as bordas perfeitamente durante o zoom
        for (let offsetX = -1; offsetX <= 1; offsetX++) {
            for (let offsetY = -1; offsetY <= 1; offsetY++) {
                let x = drawX + offsetX * MAP_SIZE - canvas.width/2;
                let y = drawY + offsetY * MAP_SIZE - canvas.height/2;
                let grad = ctx.createRadialGradient(x, y, 0, x, y, n.radius);
                grad.addColorStop(0, n.color); grad.addColorStop(1, 'transparent');
                ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(x, y, n.radius, 0, Math.PI * 2); ctx.fill();
            }
        }
    });
    ctx.globalCompositeOperation = 'source-over';

    // 2. Estrelas
    stars.forEach(s => {
        let drawX = (s.x - camera.x * s.depth) % MAP_SIZE;
        let drawY = (s.y - camera.y * s.depth) % MAP_SIZE;
        if (drawX < 0) drawX += MAP_SIZE;
        if (drawY < 0) drawY += MAP_SIZE;

        for (let offsetX = -1; offsetX <= 1; offsetX++) {
            for (let offsetY = -1; offsetY <= 1; offsetY++) {
                let x = drawX + offsetX * MAP_SIZE - canvas.width/2;
                let y = drawY + offsetY * MAP_SIZE - canvas.height/2;

                ctx.fillStyle = `rgba(255,255,255,${Math.sin(Date.now()*0.002 + s.x)*0.3+0.7})`;
                if(ship.isBoosting) {
                    ctx.strokeStyle = "rgba(200,230,255,0.4)";
                    ctx.lineWidth = s.size;
                    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - ship.vx*1.1, y - ship.vy*1.1); ctx.stroke();
                } else {
                    ctx.beginPath(); ctx.arc(x, y, s.size, 0, Math.PI * 2); ctx.fill();
                }
            }
        }
    });

    // 3. Corpos Celestes Maiores
    celestialBodies.forEach(b => {
        const drawX = b.x - camera.x;
        const drawY = b.y - camera.y;

        if (b.type === 'sun') {
            let grad = ctx.createRadialGradient(drawX, drawY, b.radius*0.1, drawX, drawY, b.radius);
            grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.2, b.color); grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(drawX, drawY, b.radius, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.save(); ctx.beginPath(); ctx.arc(drawX, drawY, b.radius, 0, Math.PI * 2); ctx.clip();
            ctx.fillStyle = b.color1; ctx.fillRect(drawX-b.radius, drawY-b.radius, b.radius*2, b.radius*2);
            b.lines.forEach(l => { ctx.fillStyle = l.c; ctx.fillRect(drawX-b.radius, drawY + l.y*b.radius, b.radius*2, l.h*b.radius); });
            let shadow = ctx.createRadialGradient(drawX - b.radius * 0.3, drawY - b.radius * 0.3, b.radius * 0.1, drawX, drawY, b.radius);
            shadow.addColorStop(0, 'transparent'); shadow.addColorStop(1, 'rgba(0,0,0,0.85)');
            ctx.fillStyle = shadow; ctx.fillRect(drawX-b.radius, drawY-b.radius, b.radius*2, b.radius*2); ctx.restore();
            if (b.ring) {
                ctx.save(); ctx.translate(drawX, drawY); ctx.rotate(0.4); ctx.strokeStyle = b.ringColor; ctx.lineWidth = b.radius * 0.15; ctx.beginPath(); ctx.ellipse(0, 0, b.radius * 2.1, b.radius * 0.25, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
            }
        }
    });
}

// --- DESENHO DO PLANO BRANCO QUADRICULADO ---
function drawWhiteGrid() {
    ctx.fillStyle = "#f5f6f8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(camera.zoom, camera.zoom);

    ctx.strokeStyle = "rgba(0, 0, 0, 0.06)";
    ctx.lineWidth = 1.5;

    let gridSize = 120;
    let startX = Math.floor((camera.x - (canvas.width / 2) / camera.zoom) / gridSize) * gridSize;
    let endX = Math.ceil((camera.x + (canvas.width / 2) / camera.zoom) / gridSize) * gridSize;
    let startY = Math.floor((camera.y - (canvas.height / 2) / camera.zoom) / gridSize) * gridSize;
    let endY = Math.ceil((camera.y + (canvas.height / 2) / camera.zoom) / gridSize) * gridSize;

    for (let x = startX; x <= endX; x += gridSize) {
        ctx.beginPath(); ctx.moveTo(x - camera.x, startY - camera.y); ctx.lineTo(x - camera.x, endY - camera.y); ctx.stroke();
    }
    for (let y = startY; y <= endY; y += gridSize) {
        ctx.beginPath(); ctx.moveTo(startX - camera.x, y - camera.y); ctx.lineTo(endX - camera.x, y - camera.y); ctx.stroke();
    }
    ctx.restore();
}

// --- EFEITO HACKER DIGITAl ---
function drawHackerEffect() {
    ctx.save();
    ctx.font = "15px Courier New";
    ctx.fillStyle = "rgba(0, 190, 0, 0.75)"; // Verde hacker estético fluido

    hackerLines.forEach(line => {
        line.y += line.speed;
        if(line.y > canvas.height) {
            line.y = -Math.random() * 200;
        }
        
        for(let i = 0; i < line.chars.length; i++) {
            let charY = line.y - (i * 18);
            if (charY < 0 || charY > canvas.height) continue;
            
            // Faz o primeiro caractere brilhar em branco
            if(i === 0) ctx.fillStyle = "rgba(200, 255, 200, 0.9)";
            else ctx.fillStyle = `rgba(0, ${210 - (i * 12)}, 0, ${1 - (i / line.chars.length)})`;

            ctx.fillText(line.chars[i], line.x, charY);
            
            // Muda aleatoriamente os caracteres no ar
            if(Math.random() > 0.98) line.chars[i] = hackerChars[Math.floor(Math.random() * hackerChars.length)];
        }
    });
    ctx.restore();
}

function drawVFX() {
    for (let i = exhaustParticles.length - 1; i >= 0; i--) {
        let p = exhaustParticles[i];
        p.x += p.vx; p.y += p.vy; p.life -= p.decay; p.size *= 0.96;
        if (p.life <= 0) { exhaustParticles.splice(i, 1); continue; }

        ctx.save();
        ctx.globalCompositeOperation = hyperDriveActive ? 'source-over' : 'lighter';
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.beginPath(); ctx.arc(p.x - camera.x, p.y - camera.y, p.size, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }

    for (let i = boomParticles.length - 1; i >= 0; i--) {
        let p = boomParticles[i];
        p.x += p.vx; p.y += p.vy; p.vx *= 0.95; p.vy *= 0.95; p.life -= p.decay;
        if (p.life <= 0) { boomParticles.splice(i, 1); continue; }

        ctx.save();
        ctx.globalCompositeOperation = hyperDriveActive ? 'source-over' : 'lighter';
        let radGrad = ctx.createRadialGradient(p.x - camera.x, p.y - camera.y, 0, p.x - camera.x, p.y - camera.y, p.size * 2.5);
        
        if (hyperDriveActive) {
            radGrad.addColorStop(0, `rgba(0, 0, 0, ${p.life * 0.5})`);
            radGrad.addColorStop(1, 'transparent');
        } else {
            radGrad.addColorStop(0, `hsla(${p.colorHue}, 100%, 70%, ${p.life})`);
            radGrad.addColorStop(0.6, `hsla(${p.colorHue + 40}, 100%, 50%, ${p.life * 0.4})`);
            radGrad.addColorStop(1, 'transparent');
        }
        ctx.fillStyle = radGrad;
        ctx.beginPath(); ctx.arc(p.x - camera.x, p.y - camera.y, p.size * 2.5, 0, Math.PI*2); ctx.fill();
        ctx.restore();
    }

    for (let i = sonicBooms.length - 1; i >= 0; i--) {
        let sb = sonicBooms[i];
        sb.radius += hyperDriveActive ? 22 : 11;
        sb.alpha -= 0.02;
        if (sb.alpha <= 0) { sonicBooms.splice(i, 1); continue; }

        ctx.save();
        ctx.strokeStyle = hyperDriveActive ? `rgba(0, 0, 0, ${sb.alpha})` : `rgba(255, 255, 255, ${sb.alpha * 0.9})`;
        ctx.lineWidth = (hyperDriveActive ? 12 : 5) * sb.alpha;
        if (!hyperDriveActive) {
            ctx.shadowBlur = 25;
            ctx.shadowColor = '#00ffff';
        }
        ctx.beginPath(); ctx.arc(sb.x - camera.x, sb.y - camera.y, sb.radius, 0, Math.PI*2); ctx.stroke();
        ctx.restore();
    }
}

// --- LOOP PRINCIPAL ---
function gameLoop() {
    let shakeX = 0, shakeY = 0;
    
    if (ship.isBoosting && !hyperDriveActive) {
        const intensity = (ship.boostDuration / 10000) * 14 + 3; 
        shakeX = (Math.random() - 0.5) * intensity;
        shakeY = (Math.random() - 0.5) * intensity;
    }

    ship.update();

    if (hyperDriveActive) {
        drawWhiteGrid();
    } else {
        ctx.fillStyle = "#010103";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.save();
        ctx.translate(canvas.width / 2 + shakeX, canvas.height / 2 + shakeY);
        ctx.scale(camera.zoom, camera.zoom);
        drawSpace();
        ctx.restore();
    }

    // Matriz compartilhada para renderizar os VFX de explosão fixados no mapa absoluto
    ctx.save();
    ctx.translate(canvas.width / 2 + shakeX, canvas.height / 2 + shakeY);
    ctx.scale(camera.zoom, camera.zoom);
    drawVFX();
    ctx.restore();

    // Renderiza o efeito hacker por cima do plano branco se ativo
    if (hyperDriveActive && hackerLines.length > 0) {
        drawHackerEffect();
    }

    // Desenha a nave estática centralizada
    ship.draw();

    // Clarão fluido de transição dimensional
    if (flashAlpha > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        flashAlpha -= 0.015; 
    }
    
    requestAnimationFrame(gameLoop);
}

gameLoop();