# Transformer-simulator
Interactive browser-based transformer simulator with calculations, equivalent circuits, phasor diagrams, and flux visualization for single-phase, autotransformer, and three-phase transformers.
The simulator supports:

* Single-phase transformer
* Autotransformer
* Three-phase transformer

It includes input parameters, calculated electrical results, equivalent circuit diagrams, phasor diagrams, and magnetic flux visualization.

---

## Features

### 1. Transformer Types

The simulator supports three transformer modes:

* **Single Phase Transformer**
* **Autotransformer**
* **Three-Phase Transformer**

Each mode updates the input fields, calculations, and circuit representation accordingly.

---

### 2. Input Parameters

Users can enter transformer and load parameters such as:

* Primary voltage
* Frequency
* Primary and secondary turns
* Equivalent resistance
* Equivalent reactance
* Load resistance
* Load reactance
* Core-loss resistance
* Magnetizing reactance
* Three-phase connection type
* Autotransformer winding turns

---

## Calculation Methodology

The simulator uses AC phasor analysis with complex numbers. Voltages, currents, and impedances are represented as:

```
Z = R + jX
```

Magnitude and angle are calculated using:

```
|Z| = sqrt(R² + X²)
∠Z = arctan(X / R)
```

---

## 1. Single-Phase Transformer

The turns ratio is:

```
a = NP / NS
```

The equivalent series impedance is:

```
Zeq = Req + jXeq
```

The load impedance is:

```
ZL = RL + jXL
```

The load referred to the primary side is:

```
ZL' = a² × ZL
```

**Without excitation branch:**

```
IP  = VP / (Zeq + ZL')
VS  = (VP - IP × Zeq) / a
IS  = a × IP
```

**With excitation branch:**

```
IC   = VP / RC
IM   = VP / jXM
Iexc = IC + IM
IL'  = VP / (Zeq + ZL')
IP   = Iexc + IL'
VS   = (VP - IL' × Zeq) / a
IS   = a × IL'
```

**Power factor:**

```
PF = cos(arctan(XL / RL))
```

**Voltage regulation:**

```
VR% = ((VS,no-load - |VS|) / |VS|) × 100
```

where V<sub>S,no-load</sub> = V<sub>P</sub> / a

**Power and loss calculations:**

- P<sub>out</sub> = |V<sub>S</sub>| × |I<sub>S</sub>| × cos(∠V<sub>S</sub> − ∠I<sub>S</sub>)
- P<sub>in</sub> = |V<sub>P</sub>| × |I<sub>P</sub>| × cos(−∠I<sub>P</sub>)
- P<sub>cu</sub> = |I<sub>P</sub>|² × R<sub>eq</sub>
- P<sub>core</sub> = |I<sub>C</sub>|² × R<sub>C</sub>
- Efficiency = (P<sub>out</sub> / P<sub>in</sub>) × 100 %

---

## 2. Phasor Diagram

The phasor diagram is drawn on the secondary side. Primary-side impedance is referred to the secondary:

```
Req,s = Req / a²
Xeq,s = Xeq / a²
```

Voltage drops:

```
VR_drop = Req,s × IS
VX_drop = jXeq,s × IS
```

Referred primary voltage:

```
VP/a = VS + VR_drop + VX_drop
```

The diagram shows secondary voltage, referred primary voltage, resistive drop, reactive drop, and load current.

---

## 3. Autotransformer

The autotransformer voltage ratio is:

```
a_auto = (NSE + NC) / NC  =  VH / VL
```

Equivalent impedance:

```
Zeq = Req + jXeq
ZL  = RL  + jXL
```

**Step-Up Mode:**

```
ZL,ref = a_auto² × ZL
Iin    = VP / (Zeq + ZL,ref)
Vout   = a_auto × (VP - Iin × Zeq)
Iout   = Iin / a_auto
```

**Step-Down Mode:**

```
ZL,ref = ZL / a_auto²
Iin    = VP / (Zeq + ZL,ref)
Vout   = (VP - Iin × Zeq) / a_auto
Iout   = a_auto × Iin
```

**Power calculations:**

- P<sub>out</sub> = |V<sub>out</sub>| × |I<sub>out</sub>| × PF
- P<sub>in</sub> = |V<sub>P</sub>| × |I<sub>in</sub>| × cos(−∠I<sub>in</sub>)
- P<sub>cu</sub> = |I<sub>in</sub>|² × R<sub>eq</sub>
- Efficiency = (P<sub>out</sub> / P<sub>in</sub>) × 100 %

**Apparent power:**

- S<sub>auto</sub> = |V<sub>out</sub>| × |I<sub>out</sub>| / 1000 &nbsp; (kVA)
- S<sub>winding</sub> = S<sub>auto</sub> × N<sub>C</sub> / (N<sub>C</sub> + N<sub>SE</sub>) &nbsp; (kVA)

---

## 4. Three-Phase Transformer

Per-phase equivalent circuit analysis is used throughout.

**Base turns ratio:**

```
a = NP / NS
```

**Primary phase voltage:**

```
Y connection:  V_phase = V_line / sqrt(3)
Δ connection:  V_phase = V_line
```

**Effective turns ratio by connection:**

| Primary | Secondary | a_eff           |
|---------|-----------|-----------------|
| Y       | Y         | a               |
| Δ       | Δ         | a               |
| Y       | Δ         | a × sqrt(3)     |
| Δ       | Y         | a / sqrt(3)     |

**Per-phase calculations:**

```
ZL'         = a_eff² × ZL
IP,phase    = VP,phase / (Zeq + ZL')
VS,phase    = (VP,phase - IP,phase × Zeq) / a_eff
IS,phase    = a_eff × IP,phase
```

**Secondary line voltage:**

```
Y connection:  VS,line = sqrt(3) × |VS,phase|
Δ connection:  VS,line = |VS,phase|
```

**Three-phase power:**

- P<sub>out,3φ</sub> = 3 × |V<sub>S,phase</sub>| × |I<sub>S,phase</sub>| × PF
- P<sub>in,3φ</sub> = 3 × |V<sub>P,phase</sub>| × |I<sub>P,phase</sub>| × cos(−∠I<sub>P,phase</sub>)
- P<sub>cu,3φ</sub> = 3 × |I<sub>P,phase</sub>|² × R<sub>eq</sub>
- Efficiency = (P<sub>out,3φ</sub> / P<sub>in,3φ</sub>) × 100 %
- S<sub>3φ</sub> = 3 × |V<sub>S,phase</sub>| × |I<sub>S,phase</sub>|

---

## 5. Flux Simulation

The flux simulation is a simplified educational visualization, not a finite-element magnetic model.

**Approximate mutual flux:**

Φ<sub>m,peak</sub> = (V<sub>P</sub> / N<sub>P</sub>) × 0.004 × (1 + saturationLevel × 0.8)

**Approximate leakage fluxes:**

- Φ<sub>l1,peak</sub> = (X<sub>eq</sub> / N<sub>P</sub>) × loadLevel × 0.0001
- Φ<sub>l2,peak</sub> = (X<sub>eq</sub> / N<sub>S</sub>) × loadLevel × 0.0001 / a

The animation visualizes mutual flux, leakage flux, resultant EMF, and saturation behavior.

---

## Assumptions

This simulator assumes:

* Sinusoidal steady-state AC operation
* RMS voltage and current values
* Linear transformer equivalent circuits
* Per-phase analysis for three-phase transformers
* Simplified excitation branch using `RC` and `XM`
* Simplified educational flux visualization

The simulator is intended for learning, demonstration, and basic transformer performance analysis.

---

## Technologies Used

This project is built using only basic web technologies:

```
HTML
CSS
JavaScript
Canvas API
```

No external JavaScript framework is required.

---

## Project Structure

```
transformer-simulator/
│
├── index.html
├── style.css
├── script.js
└── README.md
```

| File         | Purpose                                                    |
| ------------ | ---------------------------------------------------------- |
| `index.html` | Main webpage structure                                     |
| `style.css`  | Page styling and layout                                    |
| `script.js`  | Calculations, diagrams, phasor drawing, and flux animation |
| `README.md`  | Project documentation                                      |

---

## Educational Purpose

This simulator is intended for learning and demonstration purposes. It can help students understand transformer behavior through calculations and visual diagrams.

Topics covered:

* Transformer equivalent circuits
* Voltage regulation
* Power factor
* Copper loss and core loss
* Autotransformer operation
* Three-phase transformer connections
* Phasor relationships
* Magnetic flux visualization

---

## Author

Created as an educational transformer simulation project.

---

## License

This project is licensed under the [MIT License](LICENSE).
