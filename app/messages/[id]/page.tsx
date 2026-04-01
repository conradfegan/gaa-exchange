export default async function ConversationPage(props: PageProps<'/messages/[id]'>) {
  const { id } = await props.params

  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl font-bold text-brand-black">Conversation</h1>
      <p className="mt-2 text-gray-500">Conversation ID: {id}</p>
    </div>
  )
}
