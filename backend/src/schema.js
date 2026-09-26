/**
 * Esquema de la base de datos. Se ejecuta al iniciar el servidor y solo crea
 * lo que no exista, así que es seguro correrlo muchas veces.
 * (Copia de referencia en /sql/schema.sql)
 */
const { getPool } = require('./db');

const BATCHES = [
  `IF OBJECT_ID('dbo.Usuarios') IS NULL
   CREATE TABLE dbo.Usuarios (
     Id            INT IDENTITY(1,1) PRIMARY KEY,
     Nombre        NVARCHAR(60)  NOT NULL,
     Apellido      NVARCHAR(60)  NOT NULL,
     Correo        NVARCHAR(120) NOT NULL CONSTRAINT UQ_Usuarios_Correo UNIQUE,
     Telefono      NVARCHAR(20)  NOT NULL,
     PasswordHash  NVARCHAR(100) NOT NULL,
     FechaRegistro DATETIME2     NOT NULL CONSTRAINT DF_Usuarios_Fecha DEFAULT SYSUTCDATETIME()
   );`,

  `IF OBJECT_ID('dbo.Vehiculos') IS NULL
   CREATE TABLE dbo.Vehiculos (
     Id            INT IDENTITY(1,1) PRIMARY KEY,
     UsuarioId     INT NOT NULL CONSTRAINT FK_Vehiculos_Usuarios REFERENCES dbo.Usuarios(Id),
     Anio          INT           NOT NULL,
     TipoArticulo  NVARCHAR(40)  NOT NULL,
     Marca         NVARCHAR(40)  NOT NULL,
     Modelo        NVARCHAR(60)  NOT NULL,
     Motor         NVARCHAR(40)  NOT NULL,
     Transmision   NVARCHAR(20)  NOT NULL,
     Combustible   NVARCHAR(20)  NOT NULL,
     TrenManejo    NVARCHAR(4)   NOT NULL CONSTRAINT CK_Vehiculos_Tren CHECK (TrenManejo IN ('AWD','FWD','RWD','4WD')),
     Cilindros     INT           NOT NULL,
     Danio         NVARCHAR(10)  NOT NULL CONSTRAINT CK_Vehiculos_Danio CHECK (Danio IN ('Verde','Amarillo','Rojo')),
     Descripcion   NVARCHAR(1000) NULL,
     PrecioBase    DECIMAL(12,2) NOT NULL CONSTRAINT CK_Vehiculos_Base CHECK (PrecioBase > 0),
     FechaInicio   DATETIME2     NOT NULL,
     FechaCierre   DATETIME2     NOT NULL,
     PujaActual    DECIMAL(12,2) NULL,
     LiderId       INT           NULL CONSTRAINT FK_Vehiculos_Lider REFERENCES dbo.Usuarios(Id),
     TotalPujas    INT           NOT NULL CONSTRAINT DF_Vehiculos_Total DEFAULT 0,
     Resultado     NVARCHAR(10)  NULL CONSTRAINT CK_Vehiculos_Resultado CHECK (Resultado IN ('Vendido','Desierta')),
     FechaCreacion DATETIME2     NOT NULL CONSTRAINT DF_Vehiculos_Fecha DEFAULT SYSUTCDATETIME(),
     CONSTRAINT CK_Vehiculos_Fechas CHECK (FechaCierre > FechaInicio)
   );`,

  `IF OBJECT_ID('dbo.VehiculoFotos') IS NULL
   CREATE TABLE dbo.VehiculoFotos (
     Id         INT IDENTITY(1,1) PRIMARY KEY,
     VehiculoId INT NOT NULL CONSTRAINT FK_Fotos_Vehiculos REFERENCES dbo.Vehiculos(Id) ON DELETE CASCADE,
     Orden      INT NOT NULL,
     Url        NVARCHAR(MAX) NOT NULL  -- URL externa o imagen subida (data:image/...;base64)
   );`,

  `IF OBJECT_ID('dbo.Pujas') IS NULL
   CREATE TABLE dbo.Pujas (
     Id         INT IDENTITY(1,1) PRIMARY KEY,
     VehiculoId INT NOT NULL CONSTRAINT FK_Pujas_Vehiculos REFERENCES dbo.Vehiculos(Id) ON DELETE CASCADE,
     UsuarioId  INT NOT NULL CONSTRAINT FK_Pujas_Usuarios REFERENCES dbo.Usuarios(Id),
     Monto      DECIMAL(12,2) NOT NULL,
     Fecha      DATETIME2 NOT NULL CONSTRAINT DF_Pujas_Fecha DEFAULT SYSUTCDATETIME()
   );`,

  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Fotos_Vehiculo')
     CREATE INDEX IX_Fotos_Vehiculo ON dbo.VehiculoFotos(VehiculoId, Orden);`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Pujas_Vehiculo')
     CREATE INDEX IX_Pujas_Vehiculo ON dbo.Pujas(VehiculoId, Monto DESC);`,
  `IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Vehiculos_Cierre')
     CREATE INDEX IX_Vehiculos_Cierre ON dbo.Vehiculos(FechaCierre) INCLUDE (Resultado);`,
];

async function ensureSchema() {
  const pool = await getPool();
  for (const b of BATCHES) await pool.request().batch(b);
}

module.exports = { ensureSchema, BATCHES };
