# Coding guideline

## follow ticket.md generated docs

One of the examples directory name : docs/tickets/task/REI-14976_kioskdecide-the-kiosk-rendering-and-launch-the-rendering-app-minimised/

- readme.md: overview
- plan.md: detailed plan for implementation
- tasks.x.md: detailed action items for each subtask or chunk of todos of implemetation

If tasks.x.md has morethan 5 tasks to do, it's better to stop implementation after each of chunk is completed.
Pause there and ask for the review the code and follow the response.

and write in tick `[x]` on the tasks.x.md document while you finishing each item

## To generate migration

try migration:create to create the file

```bash
cd backend/supplier-stack-services/migration-knex && yarn migration:create add_rendering_mode_to_jobs
```

down is not that useful. empty is fine in most cases
instead, check existing and do nothing if the table has the changes already. so that runnig migration again does not cause any problem.

## Using models package

to make using column name shorter every model has getColumnNames() function,

```js
const M = Maincats.getColumnNames();
Maincats.query().select(M.id, M.maincat).then(console.log);
```


