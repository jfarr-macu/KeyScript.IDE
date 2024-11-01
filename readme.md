# KeyScript IDE Version 2.4 - 6/11/2024

## Overview

Coding and testing UI Scripts are done locally on a developer PC. Although not a requirement, Visual Studio Code (Integrated Development Environment) can be used for code development. Your browser's integrated debugging tools are used to debug code before it gets deployed to an actual KeyStone database.

Follow the steps below to install the KeyScript integrated development environment (IDE). Once installed, you can create interactive scripts for the KeyStone.

## Installation Instructions

1. Download and install **Visual Studio Code** (<https://code.visualstudio.com/>)
2. Run Visual Studio Code and Install the **Extension Pack for Java** (<https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-pack>)
3. Extract the contents of the **KeyScript.IDE.zip** file to the PC (for example under your Documents folder)
4. Open the KeyScript.IDE folder in Visual Studio Code
5. Open the **[keyscript.cfg](src\main\webapp\keyscript.cfg)** file to configure what instance of KeyStone you want to connect to and what local port to use. Save the file when you are done

    1. **KeyStoneWebAppURL**= set this value to the URL you use to login to KeyStone. This is usually a URL that ends in /Test or /Dev for example: <https://keystone:8443/Dev>
    2. **PORT**= set the port number that will be used on your PC to run and test scripts in the browser. The default is 4791 but you can set it to any available port

## Run the KeyScript IDE

1. Open the KeyScript.IDE folder in Visual Studio Code (the correct folder is the one that contains the pom.xml file)
2. In the **Explorer view** of Visual Studio Code find the **JAVA PROJECTS** section and **right click** on the **KeyScript.IDE** project and select **Run**
3. Open your browser to [http://localhost:4791/KeyScript_IDE/](http://localhost:4791/KeyScript_IDE/) to show the KeyScript IDE running. If you changed the PORT number adjust the URL accordingly

### Happy Coding
