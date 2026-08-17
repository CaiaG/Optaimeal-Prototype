## Overview
This prototype intends to provide a high level system design for the OPTAIMEAL research vision. The project should contain a web interface that serves both the everyday user and central planner, as well as a backline pipeline to connect the core logic with both interfaces. The interface should provide daily/weekly menus to cooks, interaction with the backend to optimize recipes in real time based on user prompted constraints. Using the same app, the central planner should be able to generate, run and compare diverse menu scenarios with dynamic inputs. Going forward the two roles will be referred to as the client and the operator.

## Reference: OPTAIMEAL Proposal (Section 4.3)
Beta version development and user interface (UI) co-creation: A beta version of the app will be developed. The user-interface will be iteratively co- designed with end-users to ensure it is intuitive and supports local languages in Kenya, starting with Swahili and English as well as Kikuyu (the most widely spoken indigenous language). The app will be developed for direct use on user devices to reduce latency and reliance on internet connectivity and will be designed to incorporate real-time data on food prices and seasonal availability from local markets. The application will be developed with two distinct UI functionalities:

For central planners: A web-based interface will allow planners to generate, run, and compare optimised menu scenarios based on national standards, empowering them to create sustainable, long-term meal plans. Key features will be informed by findings from Phase 2, but may include a dashboard for visualising metrics, a scenario-building tool with dynamic inputs, and reporting capabilities for comparing different menu plans.

For on-the-ground implementers: A mobile-first interface will provide caterers and cooks with daily/weekly menus. Crucially, this interface will enable them to adapt the central plan to real-time constraints, such as ingredient unavailability or price fluctuations. The app will suggest alternative, optimised recipes that best match the nutritional and sustainability targets of the original plan. Key features will be informed by findings from Phase 2 but may include the possibility to choose what foods that are available/accessible, specify if foods from the daily recipe that potentially are not available/accessible on the day, and specify nr of students to cook for.

## Original Proposal Modifications
- The client & operator interfaces will share a single web interface, optimized additionally for mobile use
- Less focus on latency and connectivity issues because the target demographic is observed to have stable network connection
- Postpone speech input and output functionality for the final product
- Support for english only to start

## Prototype Goals
This prototype aims to serve as a proof of concept for the OPTAIMEAL proposal. The design is focused on supporting a model of communication between the client and the operator, in order to supply flexible meal plans on a weekly basis. This guide does not include meal optimization algorithms.

https://docs.google.com/document/d/1Nbxdl2QJXxQI60ThVRaCBgMHE9dNCicBYfw93Rd6T5Q/edit?usp=sharing
