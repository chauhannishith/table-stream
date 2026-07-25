/** List/create/edit state shared by setup CRUD screens. */
export type SetupMode<TEntity> =
  | { kind: 'list' }
  | { kind: 'create' }
  | { kind: 'edit'; entity: TEntity }
