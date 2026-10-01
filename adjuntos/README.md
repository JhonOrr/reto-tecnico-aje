Agente de IA Utilizado

Se utilizo google antigravity, a través de su extensión por vscode.


Para realizar el proyecto se ejecuto el siguiente prompt, como principal

```Actua como Ingeniero de Software Senior en typescript y aws cdk.  Tengo el siguiente caso:

Debo realizar un pipeline serverless event-driven y resiliente que 
que extraiga los precios de las 3 URLs objetivo, gestione las fallas mediante colas de error y las notifique al correo: oscar.toledo@ajegroup.com, y genere de forma automática un reporte estructurado en Google Sheets / Google
Drive dentro de una carpeta /YYYY/MM/ con el archivo Precios_Comparativos_YYYY_MM_DD.

El archivo debe tener las siguientes columnas

Producto/categoria; Tienda (Dermashop, Flora y Fauna o Inkafarma); Precio; Stock (disponible / no disponible) ; url de origen; columa que diga si es el mejor precio de los 3.

A continuacion te comparto las 3 urls

- https://dermashop.pe/
- https://florayfauna.pe/
- https://inkafarma.pe/

En base al caso usa una convencion de nombres, variables y archivos que sean apropiadas.

Instala las librerias necesarias para trabajar con los siguientes servicios de aws en AWS CDK:

- SQS
- SNS
- S3

Posterior a ello, escribe el codigo completo del stack de CDK para los siguientes requisitos de arquitectura:

1. SQS: Una dead letter queue y una cola principal
2. Un topico SNS
3. Un bucket s3
4. Las funciones lambda utilizando typescript
5. Configuracion de permisos usando el minimo privilegio
```


Adicionalmente se realizo consultas continuas para entender a alto nivel el funcionamiento de las funciones lambda de scraping y poder comprobar si el agente comprendio el caso

```
Explica paso a paso las funciones lambda relacionadas a scraping hacia alguien completamente nuevo en el tema.
```

Finalmente se consulto por comandos de aws cli para probar el sistema

```
Genera comandos en aws cli para comprobar el funcionamiento del sistema
```

Adicionalmente se consulto sobre la integracion con google drive. Inicialmente propuso una integracion mediante google cloud. Al no tener exito en esta ultima etapa del proyecto, se consulto por una alternativa. Fui sugerido usar appscript de google, para lo cual tambien se solicituo mediante promp el codigo necesario para el script en google.

