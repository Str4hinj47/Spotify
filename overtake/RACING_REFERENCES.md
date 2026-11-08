# Circuit handling notes

These changes are an arcade approximation, not a validated vehicle simulator.
Highway traffic AI is unchanged. The explicitly requested drift-handling improvement also applies when drift cars are driven on the highway.

- [Efficient Ground Vehicle Path Following in Game AI](https://arxiv.org/html/2307.03379) describes steering to a look-ahead target and planning speed from upcoming curvature and braking distance. Circuit rivals use a bend-aware speed plan and integrate a speed-limited yaw response and road-relative trajectory; they are not rigid-body vehicles.
- [Introduction to Pure Pursuit](https://vinesmsuic.github.io/robotics-purepersuit/index.html) describes how steering curvature is derived from a path target and how look-ahead affects tracking. The in-game controller uses a simpler lane/heading target and its front-wheel visual angle follows simulated yaw rate.
- [Automotive Engineering II: lateral dynamics](https://www.euromotor.org/pluginfile.php/1497/mod_resource/content/0/pdf_script/lecture2_lateral_dynamics.pdf) relates tire slip, yaw and lateral force. The drift model approximates rear slip that builds under steering/load or handbrake and decays with countersteering; it does not implement a full tire or suspension model.
- [Challenger hood accent graphics](https://stencilsandstripes.com/product/2015-18-dodge-challenger-hood-stripe-with-accent-line/) illustrates vehicle-specific hood treatments. Secondary paint can target the hood, roof or both; the Challenger's separate hood mesh receives the color directly. Other cars use fitted, approximate panel masks, not exact CAD panel boundaries.

For oriented rectangle collision detection see [Johns Hopkins collision detection notes](https://www.cs.jhu.edu/~sleonard/cs436/collisiondetection.pdf). For impulse and restitution basics see [2D Simulation of Rigid Bodies](https://alan.draknek.org/physics/cs310-report.pdf).

Visible safety walls sit three metres outside the asphalt edge; circuit physics uses the same offset, with the car's rotated bounding footprint. Car impacts use oriented footprints and a simplified equal-mass impulse with positional separation, not body deformation or damage simulation.
