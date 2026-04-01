export default async function ListingPage(props: PageProps<'/listing/[id]'>) {
  const { id } = await props.params

  return (
    <div className="px-4 pt-6">
      <h1 className="text-2xl font-bold text-brand-black">Listing</h1>
      <p className="mt-2 text-gray-500">Listing ID: {id}</p>
    </div>
  )
}
