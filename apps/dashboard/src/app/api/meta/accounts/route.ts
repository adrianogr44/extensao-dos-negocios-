import { prisma } from '@/lib/prisma';
import { MetaAccountDTO } from '@/lib/meta/types';

/**
 * GET /api/meta/accounts
 * Listar todas as contas Meta conectadas
 */
export async function GET() {
  try {
    const accounts = await prisma.metaAccount.findMany({
      where: { isActive: true },
      select: {
        id: true,
        pageName: true,
        pageUsername: true,
        profilePictureUrl: true,
        isActive: true,
        connectedAt: true,
      },
    });

    const dtos: MetaAccountDTO[] = accounts.map((account) => ({
      id: account.id,
      pageName: account.pageName,
      pageUsername: account.pageUsername || undefined,
      profilePictureUrl: account.profilePictureUrl || undefined,
      isActive: account.isActive,
      connectedAt: account.connectedAt,
    }));

    return Response.json(dtos);
  } catch (error) {
    console.error('[meta/accounts]', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/meta/accounts/:id
 * Desconectar uma conta Meta
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('id');

    if (!accountId) {
      return Response.json({ error: 'Account ID is required' }, { status: 400 });
    }

    // Apenas marcar como inativo (soft delete)
    await prisma.metaAccount.update({
      where: { id: accountId },
      data: { isActive: false },
    });

    return Response.json({ success: true });
  } catch (error) {
    console.error('[meta/accounts DELETE]', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
