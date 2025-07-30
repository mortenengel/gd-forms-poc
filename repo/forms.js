var sql = require('mssql')

const config = {
  user: process.env.SQL_USER, // better stored in an app setting such as process.env.DB_USER
  password: process.env.SQL_PASSWORD, // better stored in an app setting such as process.env.DB_PASSWORD
  server: process.env.SQL_SERVER, // better stored in an app setting such as process.env.DB_SERVER
  //port: 1433, // optional, defaults to 1433, better stored in an app setting such as process.env.DB_PORT
  database: process.env.SQL_DATABASE, // better stored in an app setting such as process.env.DB_NAME
  /*authentication: {
    DefaultAuthentication
  },*/
  options: {
      encrypt: true
  }
}

/*
export interface FormSubmission {
  formId: string,
  sessionId: string,
  fieldValues: Record<string, string>
}
*/

const FormsRepository = {
  persist: async (submission) => {
    const connection = await sql.connect(config)
    const insertForm = connection.request()

    //create FormEntry row if it's not already there
    await insertForm
      .input('sessionId', submission.sessionId)
      .input('formId', submission.formId)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM [FormEntries-ApiTest] WHERE [Id] = @sessionId)
        BEGIN
          INSERT INTO [FormEntries-ApiTest]
            ([Id], [FormDefinitionId], [Created])
          VALUES
            (@sessionId, @formId, GETDATE())
        END
        `)
    const insertFields = connection.request()
    //create a temporary table of fieldnames and values
    const table = new sql.Table('#temp')
    table.create = true
    table.columns.add('FieldName', sql.NVarChar(256), { nullable: false })
    table.columns.add('Value', sql.NVarChar, { length: Infinity, nullable: true })
    Object.entries(submission.fieldValues).forEach(row => {
      table.rows.add(row[0], row[1])
    });
    //insert temp table
    await insertFields.bulk(table)
    //merge temp table into real table - for this we just always create a new FieldDefinitionId as that's very Sitecore specific, and always just use string for valuetype
    await insertFields
      .input('sessionId', submission.sessionId)
      .query(`
        MERGE INTO [FieldData-ApiTest] AS target
        USING #temp AS source
          ON target.[FormEntryId] = @sessionId AND target.[FieldName] = source.[FieldName]
        WHEN MATCHED THEN
          UPDATE SET target.[Value] = source.[Value]
        WHEN NOT MATCHED BY TARGET THEN
          INSERT ([Id], [FormEntryId], [FieldDefinitionId], [FieldName], [Value], [ValueType])
          VALUES (NEWID(), @sessionId, NEWID(), source.[FieldName], source.[Value], 'string');
      `)
    await connection.close()
  }
}

module.exports = FormsRepository